import { OPS, type Op, type WaitResult } from "@capy-kit/core";
import type { ArgDef } from "citty";
import { describe, expect, it } from "vitest";

import { argsForOp, globalArgs, numOpt, waitExitCode } from "../src/build.js";

function waitResult(over: Partial<WaitResult>): WaitResult {
  return {
    id: "jam_x",
    status: "idle",
    runState: "ready",
    waitingOn: [],
    blockedOn: [],
    terminal: true,
    settled: true,
    timedOut: false,
    lastStatus: "idle",
    lastRunState: "ready",
    elapsedMs: 1000,
    attempts: 1,
    ...over,
  };
}

function types(args: Record<string, ArgDef>): Record<string, string> {
  return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v.type)]));
}

function byName(name: string): Op {
  const op = OPS.find((o) => o.name === name);
  if (!op) throw new Error(`op not found: ${name}`);
  return op;
}

describe("CLI projection from OPS", () => {
  it("exposes exactly the op set, in order", () => {
    expect(OPS.map((op) => op.name)).toEqual([
      "delegate",
      "threads.list",
      "threads.get",
      "threads.message",
      "threads.messages",
      "wait",
      "status",
      "projects.list",
      "projects.get",
    ]);
  });

  it("delegate: positional prompt, string sugar flags, no redundant --projectId", () => {
    const args = types(argsForOp(byName("delegate")));
    expect(args).toMatchObject({
      prompt: "positional",
      model: "string",
      repos: "string",
      branch: "string",
      tags: "string",
      attachmentUrls: "string",
    });
    expect(args).not.toHaveProperty("projectId");
  });

  it("threads.list: full filters as flags, boolean --all, no positional", () => {
    const args = types(argsForOp(byName("threads.list")));
    expect(args.all).toBe("boolean");
    expect(args.status).toBe("string");
    expect(args.prNumber).toBe("string");
    expect(args.prState).toBe("string");
    expect(args.authorEmail).toBe("string");
    expect(Object.values(args)).not.toContain("positional");
    expect(args).not.toHaveProperty("projectId");
  });

  it("threads.get + wait: a required positional id", () => {
    const get = argsForOp(byName("threads.get"));
    expect(get.id).toMatchObject({ type: "positional", required: true });
    const waitArgs = argsForOp(byName("wait"));
    expect(waitArgs.id).toMatchObject({ type: "positional", required: true });
    expect(types(waitArgs).timeoutSec).toBe("string");
  });

  it("threads.message: two required positionals (id, message) + string model flag", () => {
    const args = argsForOp(byName("threads.message"));
    expect(args.id).toMatchObject({ type: "positional", required: true });
    expect(args.message).toMatchObject({ type: "positional", required: true });
    expect(types(args).model).toBe("string");
  });

  it("threads.messages + projects.list: list flags, no positional; projects.get: required positional id", () => {
    const messages = types(argsForOp(byName("threads.messages")));
    expect(messages.all).toBe("boolean");
    const list = types(argsForOp(byName("projects.list")));
    expect(list.all).toBe("boolean");
    expect(list.limit).toBe("string");
    expect(Object.values(list)).not.toContain("positional");
    const get = argsForOp(byName("projects.get"));
    expect(get.id).toMatchObject({ type: "positional", required: true });
  });

  it("globals are the documented set", () => {
    expect(Object.keys(globalArgs).sort()).toEqual(["debug", "json", "org", "profile", "project"]);
    expect(globalArgs.json.type).toBe("boolean");
  });

  it("numOpt parses numbers and rejects non-finite/empty flags", () => {
    expect(numOpt("5")).toBe(5);
    expect(numOpt("90")).toBe(90);
    expect(numOpt("abc")).toBeUndefined();
    expect(numOpt("")).toBeUndefined();
    expect(numOpt(undefined)).toBeUndefined();
  });

  it("waitExitCode: 0 done / 123 blocked-needs-you / 124 timed out", () => {
    expect(waitExitCode(waitResult({ terminal: true }))).toBe(0);
    expect(
      waitExitCode(waitResult({ terminal: false, settled: true, runState: "blocked", blockedOn: ["auth"] })),
    ).toBe(123);
    expect(waitExitCode(waitResult({ terminal: false, settled: false, timedOut: true }))).toBe(124);
  });
});
