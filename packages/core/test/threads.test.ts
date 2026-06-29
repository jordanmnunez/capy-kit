import { describe, expect, it } from "vitest";

import { threadsGet, threadsList } from "../src/index.js";
import { makePage, makeThread } from "./fixtures.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

describe("threads.list", () => {
  it("sends the full filter set as query params (coercing numbers)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makePage() }));
    const ctx = testContext({ fetch });
    await threadsList.run(
      { status: "active", prNumber: 42, prState: "open", tag: "eng-123", limit: 10 },
      ctx,
    );
    const q = calls[0]!.query;
    expect(q.get("projectId")).toBe("proj_test");
    expect(q.get("status")).toBe("active");
    expect(q.get("prNumber")).toBe("42");
    expect(q.get("prState")).toBe("open");
    expect(q.get("tag")).toBe("eng-123");
    expect(q.get("limit")).toBe("10");
  });

  it("auto-follows nextCursor when --all is set", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt === 1
        ? { json: makePage({ items: [makeThread({ id: "jam_a" })], nextCursor: "cur2", hasMore: true }) }
        : { json: makePage({ items: [makeThread({ id: "jam_b" })], nextCursor: null, hasMore: false }) },
    );
    const out = await threadsList.run({ all: true }, testContext({ fetch }));
    expect(out.items.map((t) => t.id)).toEqual(["jam_a", "jam_b"]);
    expect(out.hasMore).toBe(false);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.query.has("cursor")).toBe(false);
    expect(calls[1]!.query.get("cursor")).toBe("cur2");
  });

  it("drops an empty prNumber instead of sending a bogus prNumber=0", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makePage() }));
    await threadsList.run(
      { prNumber: "" } as unknown as Parameters<typeof threadsList.run>[0],
      testContext({ fetch }),
    );
    expect(calls[0]!.query.has("prNumber")).toBe(false);
  });

  it("throws no_project without a project", async () => {
    const { fetch } = makeMockFetch(() => ({ json: makePage() }));
    await expect(threadsList.run({}, testContext({ fetch, projectId: undefined }))).rejects.toMatchObject({
      code: "no_project",
    });
  });
});

describe("threads.get", () => {
  it("GETs /v1/threads/{id} and returns the thread", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeThread({ id: "jam_xyz" }) }));
    const out = await threadsGet.run({ id: "jam_xyz" }, testContext({ fetch }));
    expect(calls[0]!.path).toBe("/api/v1/threads/jam_xyz");
    expect(out.id).toBe("jam_xyz");
    expect(out.runState).toBe("running");
  });
});
