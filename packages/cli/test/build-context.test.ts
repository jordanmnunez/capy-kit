import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCtx } from "../src/build.js";

const SAVED = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CAPY_")) delete process.env[key];
  }
  const home = mkdtempSync(join(tmpdir(), "capy-cli-home-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  const dir = join(home, ".capy");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify({ profiles: { work: { projectId: "prj_profile" } } }));
  chmodSync(path, 0o600);
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in SAVED)) delete process.env[key];
  }
  Object.assign(process.env, SAVED);
});

describe("CLI project/profile resolution", () => {
  it("maps --profile to its configured project and ignores ambient CAPY_PROJECT_ID", () => {
    process.env.CAPY_PROJECT_ID = "prj_env";
    expect(buildCtx({ profile: "work" }).projectId).toBe("prj_profile");
  });

  it("maps explicit --project above profile and ambient project defaults", () => {
    process.env.CAPY_PROJECT_ID = "prj_env";
    expect(buildCtx({ profile: "work", project: "prj_explicit" }).projectId).toBe("prj_explicit");
  });

  it("fails when an explicitly requested profile does not exist", () => {
    expect(() => buildCtx({ profile: "missing", project: "prj_explicit" })).toThrow(/does not exist/);
  });
});
