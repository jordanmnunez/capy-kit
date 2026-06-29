import type { CapyContext } from "../../src/index.js";

export interface MockCall {
  method: string;
  url: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
  signal?: AbortSignal;
  attempt: number;
}

export interface MockReply {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

export type Responder = (call: MockCall) => MockReply | Error | Promise<MockReply | Error>;

/** A programmable fake `fetch` that records calls. The responder decides each reply. */
export function makeMockFetch(responder: Responder): { fetch: typeof fetch; calls: MockCall[] } {
  const calls: MockCall[] = [];
  const fetchImpl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();
    const u = new URL(url);
    let body: unknown;
    if (init?.body != null) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }
    const call: MockCall = {
      method,
      url,
      path: u.pathname,
      query: u.searchParams,
      body,
      headers: new Headers(init?.headers),
      signal: init?.signal ?? undefined,
      attempt: calls.length + 1,
    };
    calls.push(call);
    const reply = await responder(call);
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    const text = reply.text ?? (reply.json !== undefined ? JSON.stringify(reply.json) : "");
    return new Response(text, { status, headers: new Headers(reply.headers) });
  };
  return { fetch: fetchImpl as unknown as typeof fetch, calls };
}

/** A `fetch` that never resolves but rejects on abort — for deterministic timeout tests. */
export function hangingFetch(): typeof fetch {
  return ((_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(new DOMException("Aborted", "AbortError"));
      if (signal?.aborted) return abort();
      signal?.addEventListener("abort", abort, { once: true });
    })) as unknown as typeof fetch;
}

export function testContext(over: Partial<CapyContext> & { fetch: typeof fetch }): CapyContext {
  return {
    apiKey: "test-key",
    baseUrl: "https://capy.ai/api",
    webBaseUrl: "https://capy.ai",
    projectId: "proj_test",
    orgId: "org_test",
    validate: true, // tests exercise the output-validation boundary by default
    timeoutMs: 1_000,
    maxRetries: 2,
    defaultModel: "claude-opus-4-8",
    ...over,
  };
}
