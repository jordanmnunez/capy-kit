import { describe, expect, it } from "vitest";

import { render } from "../src/index.js";
import { makePage, makeThread } from "./fixtures.js";

describe("render", () => {
  it("json mode is JSON.stringify for any op", () => {
    const data = { a: 1, b: [2, 3] };
    expect(render("anything", data, "json")).toBe(JSON.stringify(data, null, 2));
  });

  it("delegate human output shows the id, model, and url", () => {
    const out = render(
      "delegate",
      { threadId: "thr_1", status: "active", runState: "running", model: "claude-opus-4-8", url: "https://capy.ai/x" },
      "human",
    );
    expect(out).toContain("thr_1");
    expect(out).toContain("claude-opus-4-8");
    expect(out).toContain("https://capy.ai/x");
  });

  it("threads.list human output is a table with a header", () => {
    const out = render("threads.list", makePage(), "human");
    expect(out).toContain("ID");
    expect(out).toContain("RUNSTATE");
    expect(out).toContain("jam_abc123");
    expect(out).toContain("1 thread(s)");
  });

  it("threads.get human output renders sections", () => {
    const out = render("threads.get", makeThread(), "human");
    expect(out).toContain("status: active");
    expect(out).toContain("runState: running");
    expect(out).toContain("CAP-12");
    expect(out).toContain("#42");
  });

  it("wait human output states terminal + verdict", () => {
    const out = render(
      "wait",
      {
        status: "idle",
        runState: "ready",
        terminal: true,
        timedOut: false,
        blockedOn: [],
        elapsedMs: 252_000,
        attempts: 63,
      },
      "human",
    );
    expect(out).toContain("terminal=true");
    expect(out).toContain("done");
    expect(out).toContain("4m12s");
  });

  it("unknown op falls back to JSON", () => {
    const data = { x: 1 };
    expect(render("mystery.op", data, "human")).toBe(JSON.stringify(data, null, 2));
  });
});
