import { describe, expect, it } from "vitest";

import { delegate, threadUrl } from "../src/index.js";
import { makeCreateResponse } from "./fixtures.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

describe("delegate", () => {
  it("encodes opaque project and thread ids in human-facing URLs", () => {
    expect(threadUrl("https://capy.ai/", "project/id", "thread?id")).toBe(
      "https://capy.ai/project/project%2Fid/captain/thread%3Fid",
    );
  });

  it("creates + starts a thread, parses repos, resolves the default model, returns a url", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    const ctx = testContext({ fetch });
    const out = await delegate.run(
      { prompt: "fix the thing", repos: ["owner/repo@main"], tags: ["eng-123"] },
      ctx,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.path).toBe("/api/v1/threads");
    expect(calls[0]!.body).toEqual({
      projectId: "proj_test",
      prompt: "fix the thing",
      model: "claude-opus-4-8",
      repos: [{ repoFullName: "owner/repo", branch: "main" }],
      tags: ["eng-123"],
    });
    expect(out.threadId).toBe("jam_new001");
    expect(out.model).toBe("claude-opus-4-8");
    expect(out.runState).toBe("running");
    expect(out.url).toBe("https://capy.ai/project/proj_test/captain/jam_new001");
  });

  it("resolves model aliases (sonnet -> claude-sonnet-4-6)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    await delegate.run({ prompt: "x", model: "sonnet" }, testContext({ fetch }));
    expect((calls[0]!.body as { model: string }).model).toBe("claude-sonnet-4-6");
  });

  it("sends reasoning.mode from --reasoning and echoes it in the result", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    const out = await delegate.run({ prompt: "x", reasoning: "xhigh" }, testContext({ fetch }));
    expect((calls[0]!.body as { reasoning: unknown }).reasoning).toEqual({ mode: "xhigh" });
    expect(out.reasoning).toBe("xhigh");
  });

  it("falls back to ctx.defaultReasoning, and omits reasoning when neither is set", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    await delegate.run({ prompt: "x" }, testContext({ fetch, defaultReasoning: "max" }));
    expect((calls[0]!.body as { reasoning: unknown }).reasoning).toEqual({ mode: "max" });

    const bare = makeMockFetch(() => ({ json: makeCreateResponse() }));
    const out = await delegate.run({ prompt: "x" }, testContext({ fetch: bare.fetch }));
    expect((bare.calls[0]!.body as Record<string, unknown>).reasoning).toBeUndefined();
    expect(out.reasoning).toBeNull();
  });

  it("falls back to --branch when a repo omits @branch", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    await delegate.run({ prompt: "x", repos: ["owner/repo"], branch: "dev" }, testContext({ fetch }));
    expect((calls[0]!.body as { repos: unknown[] }).repos).toEqual([{ repoFullName: "owner/repo", branch: "dev" }]);
  });

  it("rejects a repo with no branch and no --branch (validation_error)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    await expect(delegate.run({ prompt: "x", repos: ["owner/repo"] }, testContext({ fetch }))).rejects.toMatchObject({
      code: "validation_error",
    });
    expect(calls).toHaveLength(0);
  });

  it("throws no_project when no project is resolvable", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeCreateResponse() }));
    const ctx = testContext({ fetch, projectId: undefined });
    await expect(delegate.run({ prompt: "x" }, ctx)).rejects.toMatchObject({ code: "no_project" });
    expect(calls).toHaveLength(0);
  });

  it("fails closed if Capy reports creating the thread in a different project", async () => {
    const { fetch } = makeMockFetch(() => ({
      json: makeCreateResponse({ projectId: "proj_other" }),
    }));
    await expect(delegate.run({ prompt: "x" }, testContext({ fetch }))).rejects.toMatchObject({
      code: "bad_response",
      message: expect.stringMatching(/proj_other.*proj_test/),
    });
  });
});
