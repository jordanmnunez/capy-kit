import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULTS, resolveContext } from "../src/index.js";

const SAVED = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CAPY_")) delete process.env[key];
  }
  // Point HOME at an empty dir so config.json / .env layers are absent + deterministic.
  const home = mkdtempSync(join(tmpdir(), "capy-home-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in SAVED)) delete process.env[key];
  }
  Object.assign(process.env, SAVED);
});

describe("resolveContext precedence", () => {
  it("uses defaults with no input or env", () => {
    const ctx = resolveContext();
    expect(ctx.apiKey).toBe("");
    expect(ctx.baseUrl).toBe(DEFAULTS.baseUrl);
    expect(ctx.webBaseUrl).toBe(DEFAULTS.webBaseUrl);
    expect(ctx.defaultModel).toBe(DEFAULTS.defaultModel);
    expect(ctx.timeoutMs).toBe(DEFAULTS.timeoutMs);
    expect(ctx.validate).toBe(false);
  });

  it("reads CAPY_* env over defaults", () => {
    process.env.CAPY_API_KEY = "env-key";
    process.env.CAPY_PROJECT_ID = "prj_env";
    process.env.CAPY_TIMEOUT_MS = "1234";
    process.env.CAPY_VALIDATE = "true";
    const ctx = resolveContext();
    expect(ctx.apiKey).toBe("env-key");
    expect(ctx.projectId).toBe("prj_env");
    expect(ctx.timeoutMs).toBe(1234);
    expect(ctx.validate).toBe(true);
  });

  it("lets explicit input win over env", () => {
    process.env.CAPY_API_KEY = "env-key";
    process.env.CAPY_PROJECT_ID = "prj_env";
    const ctx = resolveContext({ apiKey: "explicit-key", projectId: "prj_explicit" });
    expect(ctx.apiKey).toBe("explicit-key");
    expect(ctx.projectId).toBe("prj_explicit");
  });

  it("reads ~/.capy/.env including the tuning vars, with process.env winning", () => {
    const dir = join(process.env.HOME as string, ".capy");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, ".env"),
      "CAPY_API_KEY=dotkey\nCAPY_TIMEOUT_MS=30000\nCAPY_MAX_RETRIES=5\nCAPY_VALIDATE=true\n",
    );
    const fromDot = resolveContext();
    expect(fromDot.apiKey).toBe("dotkey");
    expect(fromDot.timeoutMs).toBe(30000);
    expect(fromDot.maxRetries).toBe(5);
    expect(fromDot.validate).toBe(true);

    process.env.CAPY_TIMEOUT_MS = "1000";
    expect(resolveContext().timeoutMs).toBe(1000); // process.env wins over ~/.capy/.env
  });
});
