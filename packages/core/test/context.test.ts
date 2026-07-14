import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULTS, resolveContext } from "../src/index.js";

const SAVED = { ...process.env };

function capyDir(): string {
  return join(process.env.HOME as string, ".capy");
}

function writeConfig(value: unknown): string {
  const dir = capyDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "config.json");
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
  chmodSync(path, 0o600);
  return path;
}

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
  it("treats a genuinely missing config file as absent", () => {
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

  it("rejects malformed config JSON instead of treating it as absent", () => {
    writeConfig("{ not-json");
    process.env.CAPY_PROJECT_ID = "prj_env";
    expect(() => resolveContext({ projectId: "prj_explicit" })).toThrow(/malformed JSON/);
  });

  it("rejects non-ENOENT config read failures instead of treating them as absent", () => {
    const dir = capyDir();
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "config.json");
    mkdirSync(path, { mode: 0o700 });
    expect(() => resolveContext()).toThrow(/Unable to read/);
  });

  it("rejects an explicitly requested profile when the config or profile is missing", () => {
    expect(() => resolveContext({}, { profile: "work" })).toThrow(/profile "work".*does not exist/i);
    writeConfig({ projectId: "prj_top", profiles: { other: { projectId: "prj_other" } } });
    expect(() => resolveContext({}, { profile: "work" })).toThrow(/profile "work".*does not exist/i);
    expect(() => resolveContext({ projectId: "prj_explicit" }, { profile: "work" })).toThrow(
      /profile "work".*does not exist/i,
    );
    expect(() => resolveContext({}, { profile: "   " })).toThrow(/non-empty config profile/i);
  });

  it("makes an explicit profile's effective project authoritative over ambient project ids", () => {
    writeConfig({
      projectId: "prj_top",
      profiles: { work: { projectId: "prj_profile" } },
    });
    const dir = capyDir();
    writeFileSync(join(dir, ".env"), "CAPY_PROJECT_ID=prj_dot\n");
    chmodSync(join(dir, ".env"), 0o600);
    process.env.CAPY_PROJECT_ID = "prj_env";
    expect(resolveContext({}, { profile: "work" }).projectId).toBe("prj_profile");
  });

  it("keeps explicit --project/input precedence over profile and ambient projects", () => {
    writeConfig({ profiles: { work: { projectId: "prj_profile" } } });
    process.env.CAPY_PROJECT_ID = "prj_env";
    expect(resolveContext({ projectId: "prj_explicit" }, { profile: "work" }).projectId).toBe("prj_explicit");
  });

  it("resolves normal top-level and profile configuration", () => {
    writeConfig({
      apiKey: "top-key",
      projectId: "prj_top",
      defaultModel: "top-model",
      defaultBuildModel: "top-build-model",
      profiles: {
        work: {
          projectId: "prj_profile",
          defaultModel: "profile-model",
          defaultBuildModel: "profile-build-model",
        },
      },
    });
    expect(resolveContext()).toMatchObject({
      apiKey: "top-key",
      projectId: "prj_top",
      defaultModel: "top-model",
      defaultBuildModel: "top-build-model",
    });
    expect(resolveContext({}, { profile: "work" })).toMatchObject({
      apiKey: "top-key",
      projectId: "prj_profile",
      defaultModel: "profile-model",
      defaultBuildModel: "profile-build-model",
    });
  });

  it("lets a profile inherit top-level project config but never an ambient project fallback", () => {
    writeConfig({ projectId: "prj_top", profiles: { inherited: {} } });
    process.env.CAPY_PROJECT_ID = "prj_env";
    expect(resolveContext({}, { profile: "inherited" }).projectId).toBe("prj_top");

    writeConfig({ profiles: { isolated: {} } });
    expect(resolveContext({}, { profile: "isolated" }).projectId).toBeUndefined();
  });

  it("resolves defaultReasoning (unset by default; config.json < env < explicit input)", () => {
    expect(resolveContext().defaultReasoning).toBeUndefined();

    writeConfig({ defaultReasoning: "xhigh" });
    expect(resolveContext().defaultReasoning).toBe("xhigh");

    process.env.CAPY_DEFAULT_REASONING = "max";
    expect(resolveContext().defaultReasoning).toBe("max");

    expect(resolveContext({ defaultReasoning: "high" }).defaultReasoning).toBe("high");
  });

  it("resolves builder defaults (unset by default; config.json < env < explicit input)", () => {
    expect(resolveContext().defaultBuildModel).toBeUndefined();
    expect(resolveContext().defaultBuildReasoning).toBeUndefined();

    writeConfig({ defaultBuildModel: "gpt-5.6-terra", defaultBuildReasoning: "xhigh" });
    expect(resolveContext()).toMatchObject({
      defaultBuildModel: "gpt-5.6-terra",
      defaultBuildReasoning: "xhigh",
    });

    process.env.CAPY_DEFAULT_BUILD_MODEL = "gpt-5.6-sol";
    process.env.CAPY_DEFAULT_BUILD_REASONING = "max";
    expect(resolveContext()).toMatchObject({
      defaultBuildModel: "gpt-5.6-sol",
      defaultBuildReasoning: "max",
    });

    expect(
      resolveContext({ defaultBuildModel: "claude-opus-4-8", defaultBuildReasoning: "high" }),
    ).toMatchObject({ defaultBuildModel: "claude-opus-4-8", defaultBuildReasoning: "high" });
  });

  it("reads ~/.capy/.env including the tuning vars, with process.env winning", () => {
    const dir = capyDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, ".env"),
      "CAPY_API_KEY=dotkey\nCAPY_TIMEOUT_MS=30000\nCAPY_MAX_RETRIES=5\nCAPY_VALIDATE=true\nCAPY_DEFAULT_BUILD_MODEL=gpt-5.6-terra\nCAPY_DEFAULT_BUILD_REASONING=max\n",
    );
    chmodSync(join(dir, ".env"), 0o600);
    const fromDot = resolveContext();
    expect(fromDot.apiKey).toBe("dotkey");
    expect(fromDot.timeoutMs).toBe(30000);
    expect(fromDot.maxRetries).toBe(5);
    expect(fromDot.validate).toBe(true);
    expect(fromDot.defaultBuildModel).toBe("gpt-5.6-terra");
    expect(fromDot.defaultBuildReasoning).toBe("max");

    process.env.CAPY_TIMEOUT_MS = "1000";
    expect(resolveContext().timeoutMs).toBe(1000); // process.env wins over ~/.capy/.env
  });

  it("refuses a group/world-readable ~/.capy/.env instead of loading a leaked key", () => {
    if (process.platform === "win32") return;
    const dir = capyDir();
    mkdirSync(dir, { recursive: true });
    const path = join(dir, ".env");
    writeFileSync(path, "CAPY_API_KEY=too-open\n");
    chmodSync(path, 0o644);
    expect(() => resolveContext()).toThrow(/chmod 600/);
  });

  it("refuses a group/world-readable ~/.capy/config.json before loading a stored key", () => {
    if (process.platform === "win32") return;
    const dir = capyDir();
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "config.json");
    writeFileSync(path, JSON.stringify({ apiKey: "too-open" }));
    chmodSync(path, 0o644);
    expect(() => resolveContext()).toThrow(/chmod 600/);
  });
});
