import { describe, expect, it } from "vitest";

import { status } from "../src/index.js";
import { makePage, makeThread } from "./fixtures.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

describe("status", () => {
  it("defaults to active threads and maps faithful rows (no buckets)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makePage() }));
    const out = await status.run({}, testContext({ fetch }));
    expect(calls[0]!.query.get("status")).toBe("active");
    expect(out.count).toBe(1);
    const row = out.threads[0]!;
    expect(row.runState).toBe("running");
    expect(row.pr).toEqual({ number: 42, state: "open", url: "https://github.com/owner/repo/pull/42" });
    expect(row.url).toBe("https://capy.ai/project/proj_test/captain/jam_abc123");
    expect(row.tasks).toEqual([{ identifier: "CAP-12", status: "in_progress" }]);
  });

  it("honors an explicit status filter and handles no PR", async () => {
    const { fetch, calls } = makeMockFetch(() => ({
      json: makePage({ items: [makeThread({ pullRequests: [] })] }),
    }));
    const out = await status.run({ status: "idle" }, testContext({ fetch }));
    expect(calls[0]!.query.get("status")).toBe("idle");
    expect(out.threads[0]!.pr).toBeNull();
  });

  it("returns an empty dashboard cleanly", async () => {
    const { fetch } = makeMockFetch(() => ({ json: makePage({ items: [] }) }));
    const out = await status.run({}, testContext({ fetch }));
    expect(out.count).toBe(0);
    expect(out.threads).toEqual([]);
  });

  it("passes the --origin filter through", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makePage() }));
    await status.run({ origin: "api" }, testContext({ fetch }));
    expect(calls[0]!.query.get("origin")).toBe("api");
  });

  it("defaults authorEmail to ctx.authorEmail (your own threads on shared projects)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makePage() }));
    await status.run({}, testContext({ fetch, authorEmail: "me@co.com" }));
    expect(calls[0]!.query.get("authorEmail")).toBe("me@co.com");
  });

  it("an explicit --authorEmail overrides the ctx default", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makePage() }));
    await status.run({ authorEmail: "other@co.com" }, testContext({ fetch, authorEmail: "me@co.com" }));
    expect(calls[0]!.query.get("authorEmail")).toBe("other@co.com");
  });
});
