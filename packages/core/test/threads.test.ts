import { describe, expect, it } from "vitest";

import { threadsGet, threadsList, threadsMessage, threadsMessages, threadsStop } from "../src/index.js";
import { makePage, makeThread } from "./fixtures.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

function messagesPage(items: Array<{ id: string; source: "user" | "assistant"; content: string; createdAt: string }>, over: { nextCursor?: string | null; hasMore?: boolean } = {}) {
  return { items, nextCursor: over.nextCursor ?? null, hasMore: over.hasMore ?? false };
}

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

describe("threads.stop", () => {
  it("preflights the selected project, then POSTs stop without inventing a request body", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt === 1
        ? { json: makeThread({ id: "jam_x", projectId: "proj_test" }) }
        : { json: { id: "jam_x", status: "idle" } },
    );
    const out = await threadsStop.run({ id: "jam_x" }, testContext({ fetch }));
    expect(calls[0]!.method).toBe("GET");
    expect(calls[1]!.method).toBe("POST");
    expect(calls[1]!.path).toBe("/api/v1/threads/jam_x/stop");
    expect(calls[1]!.body).toBeUndefined();
    expect(out).toEqual({ id: "jam_x", status: "idle" });
  });

  it("refuses to stop a thread outside the selected project", async () => {
    const { fetch, calls } = makeMockFetch(() => ({
      json: makeThread({ id: "jam_x", projectId: "proj_other" }),
    }));
    await expect(threadsStop.run({ id: "jam_x" }, testContext({ fetch }))).rejects.toMatchObject({
      code: "validation_error",
      message: expect.stringMatching(/proj_other.*proj_test/),
    });
    expect(calls).toHaveLength(1);
  });
});

describe("threads.message", () => {
  it("preflights the selected project, then POSTs the message and resolves the model alias", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt === 1
        ? { json: makeThread({ id: "jam_x", projectId: "proj_test" }) }
        : { json: { id: "msg_1", status: "sent" } },
    );
    const out = await threadsMessage.run(
      { id: "jam_x", message: "fix the rest of the stack", model: "opus" },
      testContext({ fetch }),
    );
    expect(calls[0]!.method).toBe("GET");
    expect(calls[1]!.method).toBe("POST");
    expect(calls[1]!.path).toBe("/api/v1/threads/jam_x/message");
    expect(calls[1]!.body).toMatchObject({ message: "fix the rest of the stack", model: "claude-opus-4-8" });
    expect(out).toEqual({ id: "msg_1", status: "sent" });
  });

  it("refuses to steer a thread outside the selected project", async () => {
    const { fetch, calls } = makeMockFetch(() => ({
      json: makeThread({ id: "jam_x", projectId: "proj_other" }),
    }));
    await expect(
      threadsMessage.run({ id: "jam_x", message: "do not cross the boundary" }, testContext({ fetch })),
    ).rejects.toMatchObject({
      code: "validation_error",
      message: expect.stringMatching(/proj_other.*proj_test/),
    });
    expect(calls).toHaveLength(1);
  });

  it("passes reasoning for the turn as reasoning.mode (explicit only — no config fallback)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: { id: "msg_3", status: "sent" } }));
    await threadsMessage.run(
      { id: "jam_x", message: "go deeper on the race condition", reasoning: "xhigh" },
      testContext({ fetch, defaultReasoning: "max", projectId: undefined }),
    );
    expect((calls[0]!.body as { reasoning: unknown }).reasoning).toEqual({ mode: "xhigh" });
  });

  it("passes queue/interrupt delivery mode and a caller message id through faithfully", async () => {
    const response = {
      id: "msg_5",
      status: "queued" as const,
      inputEventId: "evt_5",
      timelineSequence: "42",
      appendState: "inserted" as const,
    };
    const { fetch, calls } = makeMockFetch(() => ({ json: response }));
    const out = await threadsMessage.run(
      { id: "jam_x", message: "do this next", mode: "queue", messageId: "steer-42" },
      testContext({ fetch, projectId: undefined }),
    );
    expect(calls[0]!.body).toMatchObject({ message: "do this next", mode: "queue", messageId: "steer-42" });
    expect(out).toEqual(response);
  });

  it("omits reasoning when not passed, even if ctx.defaultReasoning is set", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: { id: "msg_4", status: "sent" } }));
    await threadsMessage.run(
      { id: "jam_x", message: "ping" },
      testContext({ fetch, defaultReasoning: "max", projectId: undefined }),
    );
    expect((calls[0]!.body as Record<string, unknown>).reasoning).toBeUndefined();
  });

  it("omits model when none is passed (continues with the thread's current model)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: { id: "msg_2", status: "sent" } }));
    await threadsMessage.run({ id: "jam_x", message: "ping" }, testContext({ fetch, projectId: undefined }));
    expect((calls[0]!.body as Record<string, unknown>).model).toBeUndefined();
  });

  it("rejects more than ten attachment URLs before making a request", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: { id: "msg_6", status: "sent" } }));
    await expect(
      threadsMessage.run(
        { id: "jam_x", message: "too many", attachmentUrls: Array.from({ length: 11 }, (_, i) => `https://x.test/${i}`) },
        testContext({ fetch, projectId: undefined }),
      ),
    ).rejects.toMatchObject({ code: "validation_error" });
    expect(calls).toHaveLength(0);
  });
});

describe("threads.messages", () => {
  it("returns one page reversed to oldest→newest", async () => {
    const { fetch } = makeMockFetch(() =>
      ({
        json: messagesPage([
          { id: "m2", source: "assistant", content: "newest", createdAt: "2026-06-26T10:02:00.000Z" },
          { id: "m1", source: "user", content: "oldest", createdAt: "2026-06-26T10:00:00.000Z" },
        ]),
      }),
    );
    const out = await threadsMessages.run({ id: "jam_x" }, testContext({ fetch }));
    expect(out.items.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("--all follows every page then returns the full log oldest→newest", async () => {
    const { fetch } = makeMockFetch((call) =>
      call.attempt === 1
        ? { json: messagesPage([{ id: "m3", source: "assistant", content: "c", createdAt: "t3" }], { nextCursor: "c2", hasMore: true }) }
        : { json: messagesPage([{ id: "m2", source: "user", content: "b", createdAt: "t2" }, { id: "m1", source: "user", content: "a", createdAt: "t1" }]) },
    );
    const out = await threadsMessages.run({ id: "jam_x", all: true }, testContext({ fetch }));
    expect(out.items.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(out.hasMore).toBe(false);
  });
});
