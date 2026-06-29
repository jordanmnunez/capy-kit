import { OPS } from "@capy-kit/core";
import type { ArgDef } from "citty";
import { describe, expect, it } from "vitest";

import { argsForOp, globalArgs, numOpt } from "../src/build.js";

function types(args: Record<string, ArgDef>): Record<string, string> {
  return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v.type)]));
}

describe("CLI projection from OPS", () => {
  it("exposes exactly the M1 op set, in order", () => {
    expect(OPS.map((op) => op.name)).toEqual(["delegate", "threads.list", "threads.get", "wait", "status"]);
  });

  it("delegate: positional prompt, string sugar flags, no redundant --projectId", () => {
    const args = types(argsForOp(OPS[0]!));
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
    const args = types(argsForOp(OPS[1]!));
    expect(args.all).toBe("boolean");
    expect(args.status).toBe("string");
    expect(args.prNumber).toBe("string");
    expect(args.prState).toBe("string");
    expect(args.authorEmail).toBe("string");
    expect(Object.values(args)).not.toContain("positional");
    expect(args).not.toHaveProperty("projectId");
  });

  it("threads.get + wait: a required positional id", () => {
    const get = argsForOp(OPS[2]!);
    expect(get.id).toMatchObject({ type: "positional", required: true });
    const waitArgs = argsForOp(OPS[3]!);
    expect(waitArgs.id).toMatchObject({ type: "positional", required: true });
    expect(types(waitArgs).timeoutSec).toBe("string");
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
});
