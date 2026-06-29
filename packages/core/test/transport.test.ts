import { describe, expect, it } from "vitest";

import { backoffMs, CapyError, request } from "../src/index.js";
import { hangingFetch, makeMockFetch, testContext } from "./helpers/mock.js";

describe("transport", () => {
  it("sends auth, no body on GET, and parses JSON", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: { ok: true } }));
    const ctx = testContext({ fetch });
    const out = await request<{ ok: boolean }>(ctx, { method: "GET", path: "/v1/threads", query: { projectId: "proj_test" } });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://capy.ai/api/v1/threads?projectId=proj_test");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer test-key");
    expect(calls[0]!.body).toBeUndefined();
  });

  it("sends a defined body (including falsy/empty) with Content-Type", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: {} }));
    const ctx = testContext({ fetch });
    await request(ctx, { method: "POST", path: "/v1/threads", body: {} });
    expect(calls[0]!.body).toEqual({});
    expect(calls[0]!.headers.get("content-type")).toBe("application/json");
  });

  it("throws no_api_key without hitting the network", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: {} }));
    const ctx = testContext({ fetch, apiKey: "" });
    await expect(request(ctx, { method: "GET", path: "/v1/threads" })).rejects.toMatchObject({ code: "no_api_key" });
    expect(calls).toHaveLength(0);
  });

  it("maps status codes to CapyError codes with details + requestId", async () => {
    const cases: Array<[number, string]> = [
      [401, "unauthorized"],
      [403, "forbidden"],
      [404, "not_found"],
      [422, "validation_error"],
      [500, "api_error"],
    ];
    for (const [statusCode, code] of cases) {
      const { fetch } = makeMockFetch(() => ({
        status: statusCode,
        json: { error: { code: "x", message: `boom ${statusCode}`, details: { field: "prompt" } } },
        headers: { "x-request-id": "req_123" },
      }));
      const ctx = testContext({ fetch, maxRetries: 0 });
      const err = (await request(ctx, { method: "GET", path: "/v1/x" }).catch((e) => e)) as CapyError;
      expect(err).toBeInstanceOf(CapyError);
      expect(err.code).toBe(code);
      expect(err.status).toBe(statusCode);
      expect(err.message).toContain(`boom ${statusCode}`);
      expect(err.requestId).toBe("req_123");
      expect(err.details).toEqual({ field: "prompt" });
    }
  });

  it("retries idempotent GET on 503 honoring Retry-After, then succeeds", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt === 1
        ? { status: 503, headers: { "retry-after": "0" } }
        : { json: { ok: true } },
    );
    const ctx = testContext({ fetch, maxRetries: 2 });
    const out = await request<{ ok: boolean }>(ctx, { method: "GET", path: "/v1/x" });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("retries idempotent GET on network error up to maxRetries", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt < 3 ? new TypeError("fetch failed") : { json: { ok: true } },
    );
    const ctx = testContext({ fetch, maxRetries: 2 });
    const out = await request<{ ok: boolean }>(ctx, { method: "GET", path: "/v1/x" });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
  });

  it("does NOT retry non-idempotent POST on 500", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ status: 500, json: { error: { code: "x", message: "nope" } } }));
    const ctx = testContext({ fetch, maxRetries: 3 });
    await expect(request(ctx, { method: "POST", path: "/v1/threads", body: { a: 1 } })).rejects.toMatchObject({
      code: "api_error",
    });
    expect(calls).toHaveLength(1);
  });

  it("gives up after exhausting retries on persistent rate limit", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ status: 429, headers: { "retry-after": "0" } }));
    const ctx = testContext({ fetch, maxRetries: 2 });
    await expect(request(ctx, { method: "GET", path: "/v1/x" })).rejects.toMatchObject({ code: "rate_limited" });
    expect(calls).toHaveLength(3); // 1 + 2 retries
  });

  it("maps the timeout to CapyError('timeout')", async () => {
    const ctx = testContext({ fetch: hangingFetch(), timeoutMs: 20, maxRetries: 0 });
    await expect(request(ctx, { method: "GET", path: "/v1/x" })).rejects.toMatchObject({ code: "timeout" });
  });

  it("does NOT retry a timeout even on an idempotent request with maxRetries>0 (single-shot)", async () => {
    let count = 0;
    const fetchImpl = ((_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        count++;
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      })) as unknown as typeof fetch;
    const ctx = testContext({ fetch: fetchImpl, timeoutMs: 15, maxRetries: 3 });
    await expect(request(ctx, { method: "GET", path: "/v1/x" })).rejects.toMatchObject({ code: "timeout" });
    expect(count).toBe(1);
  });

  it("invokes onResponse once per attempt with the live Response", async () => {
    const seen: number[] = [];
    const { fetch } = makeMockFetch((c) =>
      c.attempt === 1 ? { status: 503, headers: { "retry-after": "0" } } : { json: { ok: true } },
    );
    const ctx = testContext({ fetch, maxRetries: 2, onResponse: (res) => seen.push(res.status) });
    await request(ctx, { method: "GET", path: "/v1/x" });
    expect(seen).toEqual([503, 200]);
  });

  it("retries a 500 carrying Retry-After (Retry-After honored beyond 429/503)", async () => {
    const { fetch, calls } = makeMockFetch((c) =>
      c.attempt === 1 ? { status: 500, headers: { "retry-after": "0" } } : { json: { ok: true } },
    );
    const out = await request<{ ok: boolean }>(testContext({ fetch, maxRetries: 2 }), { method: "GET", path: "/v1/x" });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("backoffMs honors Retry-After (uncapped by the 5s exp ceiling) but caps pathological values + exp", () => {
    expect(backoffMs(1, 30_000)).toBe(30_000);
    expect(backoffMs(1, 10_000_000)).toBe(120_000);
    expect(backoffMs(1, 0)).toBe(0);
    expect(backoffMs(10)).toBe(5_000);
    expect(backoffMs(1)).toBeLessThanOrEqual(5_000);
  });

  it("redacts Authorization in the onRequest seam but sends the real token", async () => {
    let seen: string | null = null;
    const { fetch, calls } = makeMockFetch(() => ({ json: {} }));
    const ctx = testContext({ fetch, onRequest: (req) => (seen = req.headers.get("authorization")) });
    await request(ctx, { method: "GET", path: "/v1/x" });
    expect(seen).toBe("Bearer ***redacted***");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer test-key");
  });
});
