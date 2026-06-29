import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_MODEL } from "../model.js";

// Resolved, ready-to-use context. Every op takes one of these. project/org are
// optional here and resolved per-call (`arg ?? ctx.projectId ?? …`) so one client
// drives many projects. `fetch` is injectable for tests / MCP (network-free ops).
export interface CapyContext {
  apiKey: string;
  baseUrl: string;
  webBaseUrl: string;
  projectId?: string;
  orgId?: string;
  fetch: typeof fetch;
  validate: boolean;
  timeoutMs: number;
  maxRetries: number;
  defaultModel: string;
  onRequest?: (req: Request) => void;
  onResponse?: (res: Response) => void;
}

export interface CapyContextInput {
  apiKey?: string;
  baseUrl?: string;
  webBaseUrl?: string;
  projectId?: string;
  orgId?: string;
  fetch?: typeof fetch;
  validate?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  defaultModel?: string;
  onRequest?: (req: Request) => void;
  onResponse?: (res: Response) => void;
}

export const DEFAULTS = {
  baseUrl: "https://capy.ai/api",
  // Confirmed live (2026-06-26): capy.ai/project/{projectId}/captain/{threadId}.
  // Override via CAPY_WEB_URL / config.webBaseUrl.
  webBaseUrl: "https://capy.ai",
  validate: false,
  timeoutMs: 60_000,
  maxRetries: 2,
  defaultModel: DEFAULT_MODEL,
} as const;

interface FileLayer {
  apiKey?: string;
  baseUrl?: string;
  webBaseUrl?: string;
  projectId?: string;
  orgId?: string;
  defaultModel?: string;
}

function firstString(...vals: Array<unknown>): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function toInt(v: unknown): number | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v !== "string") return undefined;
  if (/^(1|true|yes|on)$/i.test(v)) return true;
  if (/^(0|false|no|off)$/i.test(v)) return false;
  return undefined;
}

/** ~/.capy/config.json, optionally merging a named `profile` block over the top level. */
function readConfigFile(profile?: string): FileLayer {
  try {
    const raw = readFileSync(join(homedir(), ".capy", "config.json"), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown> & { profiles?: Record<string, FileLayer> };
    const base = parsed as FileLayer;
    const block = profile ? parsed.profiles?.[profile] : undefined;
    return { ...base, ...(block ?? {}) };
  } catch {
    return {};
  }
}

/** ~/.capy/.env — minimal KEY=VALUE parser for CAPY_* vars (no shell expansion). */
function readDotEnv(): Record<string, string> {
  try {
    const raw = readFileSync(join(homedir(), ".capy", ".env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || !m[1]) continue;
      let val = (m[2] ?? "").trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Build a CapyContext. Precedence (low -> high):
 *   DEFAULTS < ~/.capy/config.json < ~/.capy/.env < process.env (CAPY_*) < explicit input.
 * Never throws on a missing key — transport raises `no_api_key` only when a request is attempted.
 */
export function resolveContext(input: CapyContextInput = {}, opts?: { profile?: string }): CapyContext {
  const file = readConfigFile(opts?.profile);
  const dot = readDotEnv();
  const env = process.env;

  const pick = (key: `CAPY_${string}`, fileVal?: string): string | undefined =>
    firstString(env[key], dot[key], fileVal);

  return {
    apiKey: input.apiKey ?? pick("CAPY_API_KEY", file.apiKey) ?? "",
    baseUrl: input.baseUrl ?? pick("CAPY_BASE_URL", file.baseUrl) ?? DEFAULTS.baseUrl,
    webBaseUrl: input.webBaseUrl ?? pick("CAPY_WEB_URL", file.webBaseUrl) ?? DEFAULTS.webBaseUrl,
    projectId: input.projectId ?? pick("CAPY_PROJECT_ID", file.projectId),
    orgId: input.orgId ?? pick("CAPY_ORG_ID", file.orgId),
    fetch: input.fetch ?? globalThis.fetch,
    validate: input.validate ?? toBool(env.CAPY_VALIDATE ?? dot.CAPY_VALIDATE) ?? DEFAULTS.validate,
    timeoutMs: input.timeoutMs ?? toInt(env.CAPY_TIMEOUT_MS ?? dot.CAPY_TIMEOUT_MS) ?? DEFAULTS.timeoutMs,
    maxRetries: input.maxRetries ?? toInt(env.CAPY_MAX_RETRIES ?? dot.CAPY_MAX_RETRIES) ?? DEFAULTS.maxRetries,
    defaultModel: input.defaultModel ?? pick("CAPY_DEFAULT_MODEL", file.defaultModel) ?? DEFAULTS.defaultModel,
    onRequest: input.onRequest,
    onResponse: input.onResponse,
  };
}
