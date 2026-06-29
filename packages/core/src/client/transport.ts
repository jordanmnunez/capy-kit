import { sleep } from "../util.js";
import { CapyError, statusToCode, type CapyErrorCode } from "./errors.js";
import type { CapyContext } from "./context.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method: HttpMethod;
  path: string; // e.g. "/v1/threads"
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown; // serialized and sent iff !== undefined (so valid falsy bodies are sent)
  /** Override the default idempotency inference (GET/PUT/DELETE idempotent, POST/PATCH not). */
  idempotent?: boolean;
  signal?: AbortSignal;
}

const REDACTED_AUTH = "Bearer ***redacted***";
const RETRYABLE_STATUS = (status: number): boolean => status === 429 || (status >= 500 && status <= 599);
const MAX_BACKOFF_MS = 5_000; // ceiling for computed exponential backoff
const MAX_RETRY_AFTER_MS = 120_000; // generous ceiling so a pathological Retry-After can't hang us
const BASE_BACKOFF_MS = 250;

function isIdempotent(opts: RequestOptions): boolean {
  if (opts.idempotent !== undefined) return opts.idempotent;
  return opts.method === "GET" || opts.method === "PUT" || opts.method === "DELETE";
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base + p);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function maskedHeaders(headers: Record<string, string>): Headers {
  const h = new Headers(headers);
  if (h.has("authorization")) h.set("Authorization", REDACTED_AUTH);
  return h;
}

export function backoffMs(attempt: number, retryAfterMs?: number): number {
  // Honor an explicit server Retry-After (bounded only by a generous ceiling so a
  // pathological header can't hang the client). Only the COMPUTED exponential backoff
  // is capped at MAX_BACKOFF_MS.
  if (retryAfterMs !== undefined && retryAfterMs >= 0) return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
  const exp = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.min(exp + jitter, MAX_BACKOFF_MS);
}

function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  if (/^\d+$/.test(raw.trim())) return Number(raw.trim()) * 1000;
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return undefined;
  return Math.max(0, when - Date.now());
}

function requestIdFrom(headers: Headers, body?: { error?: { details?: unknown } }): string | undefined {
  for (const key of ["x-request-id", "x-amzn-requestid", "request-id", "cf-ray"]) {
    const v = headers.get(key);
    if (v) return v;
  }
  const details = body?.error?.details;
  if (details && typeof details === "object" && "requestId" in details) {
    const rid = (details as { requestId?: unknown }).requestId;
    if (typeof rid === "string") return rid;
  }
  return undefined;
}

async function errorFromResponse(res: Response): Promise<CapyError> {
  let parsed: { error?: { code?: string; message?: string; details?: unknown } } | undefined;
  let text = "";
  try {
    text = await res.text();
    parsed = text ? (JSON.parse(text) as typeof parsed) : undefined;
  } catch {
    /* non-JSON error body — fall back to status text */
  }
  const code: CapyErrorCode = statusToCode(res.status);
  const message =
    parsed?.error?.message ?? (text && text.length < 300 ? text : `${res.status} ${res.statusText}`.trim());
  // Honor Retry-After on any retryable status (429 + 5xx), not just 429/503.
  const retryAfterMs = RETRYABLE_STATUS(res.status) ? parseRetryAfter(res.headers) : undefined;
  return new CapyError({
    code,
    message: message || `HTTP ${res.status}`,
    status: res.status,
    retryAfterMs,
    requestId: requestIdFrom(res.headers, parsed),
    details: parsed?.error?.details,
  });
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new CapyError({
      code: "bad_response",
      message: "Capy returned a non-JSON response body.",
      status: res.status,
      requestId: requestIdFrom(res.headers),
      cause,
    });
  }
}

interface TimeoutHandle {
  signal: AbortSignal;
  timedOut: () => boolean;
  cancel: () => void;
}

function withTimeout(timeoutMs: number, external?: AbortSignal): TimeoutHandle {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cancel: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

function mapThrown(e: unknown, timedOut: boolean, external?: AbortSignal): CapyError | Error {
  if (e instanceof CapyError) return e;
  if (timedOut) {
    return new CapyError({ code: "timeout", message: "Request timed out.", cause: e });
  }
  // Caller-initiated abort: surface the original AbortError so the caller can detect cancellation.
  if (external?.aborted && e instanceof Error && e.name === "AbortError") return e;
  const message = e instanceof Error ? e.message : String(e);
  return new CapyError({ code: "network_error", message: `Network request failed: ${message}`, cause: e });
}

/**
 * The one HTTP primitive. Adds auth, idempotency-aware retry honoring Retry-After,
 * an AbortSignal timeout, {error}->CapyError mapping, and an onRequest/onResponse seam
 * that redacts Authorization. Returns parsed JSON (typed by the caller from schema.d.ts).
 */
export async function request<T>(ctx: CapyContext, opts: RequestOptions): Promise<T> {
  if (!ctx.apiKey) {
    throw new CapyError({
      code: "no_api_key",
      message: "No Capy API key. Set CAPY_API_KEY or run `capy init`.",
    });
  }

  const url = buildUrl(ctx.baseUrl, opts.path, opts.query);
  const idempotent = isIdempotent(opts);
  const maxAttempts = idempotent ? Math.max(1, ctx.maxRetries + 1) : 1;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.apiKey}`,
    Accept: "application/json",
  };
  let bodyText: string | undefined;
  if (opts.body !== undefined) {
    bodyText = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }

  let attempt = 0;
  for (;;) {
    attempt++;
    const timeout = withTimeout(ctx.timeoutMs, opts.signal);
    let res: Response;
    try {
      ctx.onRequest?.(new Request(url, { method: opts.method, headers: maskedHeaders(headers) }));
      const init: RequestInit = { method: opts.method, headers, signal: timeout.signal };
      if (bodyText !== undefined) init.body = bodyText;
      res = await ctx.fetch(url, init);
    } catch (e) {
      timeout.cancel();
      const mapped = mapThrown(e, timeout.timedOut(), opts.signal);
      // Retry transient network errors on idempotent requests. Timeouts are intentionally
      // single-shot (code "timeout"): retrying a timed-out request would multiply worst-case
      // latency by maxRetries. The poll layer (pollUntilTerminal) instead rides out a transient
      // timeout across ticks, so long waits still survive a slow poll without amplifying a
      // one-off request's latency.
      if (
        mapped instanceof CapyError &&
        mapped.code === "network_error" &&
        idempotent &&
        attempt < maxAttempts
      ) {
        await sleep(backoffMs(attempt), opts.signal);
        continue;
      }
      throw mapped;
    }
    timeout.cancel();
    ctx.onResponse?.(res);

    if (res.ok) return parseJson<T>(res);

    const err = await errorFromResponse(res);
    if (idempotent && attempt < maxAttempts && RETRYABLE_STATUS(res.status)) {
      await sleep(backoffMs(attempt, err.retryAfterMs), opts.signal);
      continue;
    }
    throw err;
  }
}
