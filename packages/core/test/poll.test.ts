import { describe, expect, it } from "vitest";

import { pollUntilTerminal, wait, waitForThread } from "../src/index.js";
import { makeThread } from "./fixtures.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

describe("pollUntilTerminal / wait", () => {
  it("settles when the thread reaches idle (terminal=true)", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt < 2
        ? { json: makeThread({ status: "active", runState: "running" }) }
        : { json: makeThread({ status: "idle", runState: "ready" }) },
    );
    const result = await waitForThread(testContext({ fetch }), { id: "jam_x", intervalMs: 5 });
    expect(result.terminal).toBe(true);
    expect(result.settled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.attempts).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it("stops on a blocked thread with terminal=false (needs a human)", async () => {
    const { fetch } = makeMockFetch(() => ({
      json: makeThread({ status: "active", runState: "blocked", blockedOn: ["auth"] }),
    }));
    const result = await waitForThread(testContext({ fetch }), { id: "jam_x", intervalMs: 5 });
    expect(result.settled).toBe(true);
    expect(result.terminal).toBe(false);
    expect(result.blockedOn).toEqual(["auth"]);
  });

  it("times out when the thread never settles (terminal=false, timedOut=true)", async () => {
    const { fetch } = makeMockFetch(() => ({ json: makeThread({ status: "active", runState: "running" }) }));
    const result = await waitForThread(testContext({ fetch }), { id: "jam_x", intervalMs: 5, timeoutMs: 30 });
    expect(result.timedOut).toBe(true);
    expect(result.terminal).toBe(false);
    expect(result.settled).toBe(false);
  });

  it("rides out a transient error and keeps polling until the thread settles", async () => {
    // maxRetries:0 so the transient 500 reaches the poll layer (not swallowed by transport).
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt < 2
        ? { status: 500, json: { error: { code: "x", message: "blip" } } }
        : { json: makeThread({ status: "idle", runState: "ready" }) },
    );
    const result = await waitForThread(testContext({ fetch, maxRetries: 0 }), {
      id: "jam_x",
      intervalMs: 5,
    });
    expect(result.terminal).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("aborts fast on a permanent error (404 not_found)", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ status: 404, json: { error: { code: "x", message: "gone" } } }));
    await expect(
      waitForThread(testContext({ fetch }), { id: "jam_x", intervalMs: 5, timeoutMs: 1000 }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(calls).toHaveLength(1);
  });

  it("surfaces the transient error if it never observes the thread before the budget", async () => {
    const { fetch } = makeMockFetch(() => ({ status: 500, json: { error: { code: "x", message: "down" } } }));
    await expect(
      waitForThread(testContext({ fetch, maxRetries: 0 }), { id: "jam_x", intervalMs: 5, timeoutMs: 30 }),
    ).rejects.toMatchObject({ code: "api_error" });
  });

  it("rejects a non-thread kind", async () => {
    const { fetch } = makeMockFetch(() => ({ json: makeThread() }));
    const gen = pollUntilTerminal(testContext({ fetch }), { id: "tsk_1", kind: "task" as "thread", intervalMs: 5 });
    await expect(gen.next()).rejects.toMatchObject({ code: "validation_error" });
  });

  it("wait op converts seconds and settles immediately", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeThread({ status: "idle", runState: "ready" }) }));
    const result = await wait.run({ id: "jam_x", timeoutSec: 5, intervalSec: 1 }, testContext({ fetch }));
    expect(result.terminal).toBe(true);
    expect(result.attempts).toBe(1);
    expect(calls).toHaveLength(1);
  });
});
