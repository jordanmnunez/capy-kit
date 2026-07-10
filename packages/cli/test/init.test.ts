import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildInitConfig,
  initDiscoveryContext,
  initialProjectChoice,
  normalizeOfflineProjectId,
  projectPickerOptions,
  promptForProject,
  resolveLiveProjectInput,
  type ProjectIdentity,
  type ProjectPickerChoice,
} from "../src/commands/init.js";

const PROJECTS: ProjectIdentity[] = [
  {
    id: "proj_alpha",
    name: "Alpha",
    taskCode: "ALP",
    repos: [{ repoFullName: "org/alpha", branch: "main" }],
  },
  {
    id: "proj_beta",
    name: "Shared Name",
    taskCode: "BET",
    repos: [{ repoFullName: "org/beta", branch: "develop" }],
  },
  {
    id: "proj_gamma",
    name: "Shared Name",
    taskCode: "GAM",
    repos: [{ repoFullName: "org/gamma", branch: "main" }],
  },
];

const SAVED = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("CAPY_")) delete process.env[key];
  }
  const home = mkdtempSync(join(tmpdir(), "capy-init-home-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in SAVED)) delete process.env[key];
  }
  Object.assign(process.env, SAVED);
});

describe("capy init project selection", () => {
  it("enables response validation for live identity discovery", () => {
    process.env.CAPY_BASE_URL = "https://attacker.invalid/api";
    expect(initDiscoveryContext("capy_test")).toMatchObject({
      apiKey: "capy_test",
      baseUrl: "https://capy.ai/api",
      validate: true,
      timeoutMs: 5_000,
      maxRetries: 0,
    });
  });

  it("sanitizes API-controlled project picker labels without changing canonical ids", () => {
    const options = projectPickerOptions([
      {
        id: "proj_raw",
        name: "Safe\u001b]8;;https://evil.test\u0007Name\u001b]8;;\u0007",
        taskCode: "RAW\u001b[31m",
        repos: [{ repoFullName: "org/repo\u001b[2J", branch: "main" }],
      },
    ]);

    expect(options[0]).toMatchObject({
      value: { kind: "project", projectId: "proj_raw" },
      label: "SafeName",
    });
    expect(options[0]?.hint).not.toContain("\u001b");
  });

  it("builds name-first choices with canonical ids and disambiguating hints", () => {
    const options = projectPickerOptions(PROJECTS);
    expect(options[0]).toMatchObject({
      value: { kind: "project", projectId: "proj_alpha" },
      label: "Alpha",
      hint: expect.stringMatching(/ALP.*org\/alpha@main.*proj_alpha/),
    });
    expect(options.filter((option) => option.label === "Shared Name")).toHaveLength(2);
    expect(options.at(-2)?.value).toEqual({ kind: "manual" });
    expect(options.at(-1)?.value).toEqual({ kind: "none" });
  });

  it("never guesses the first project and only preselects an exact configured id", () => {
    const options = projectPickerOptions(PROJECTS);
    expect(initialProjectChoice(options, undefined)).toEqual({ kind: "none" });
    expect(initialProjectChoice(options, "proj_beta")).toEqual({ kind: "project", projectId: "proj_beta" });
    expect(initialProjectChoice(options, "proj_unknown")).toEqual({ kind: "manual" });
  });

  it("resolves canonical ids and unique exact names, but rejects zero or ambiguous name matches", () => {
    expect(resolveLiveProjectInput(" proj_alpha ", PROJECTS)).toBe("proj_alpha");
    expect(resolveLiveProjectInput("alpha", PROJECTS)).toBe("proj_alpha");
    expect(resolveLiveProjectInput("", PROJECTS)).toBeUndefined();
    expect(() => resolveLiveProjectInput("missing", PROJECTS)).toThrow(/No visible project/);
    expect(() => resolveLiveProjectInput("shared name", PROJECTS)).toThrow(/ambiguous.*proj_beta.*proj_gamma/i);
  });

  it("returns the selected live project's canonical id without invoking manual input", async () => {
    let textCalled = false;
    const result = await promptForProject(
      {
        async select() {
          return { kind: "project", projectId: "proj_beta" };
        },
        async text() {
          textCalled = true;
          return "unused";
        },
        warn() {},
      },
      PROJECTS,
      undefined,
      undefined,
    );
    expect(result).toEqual({ cancelled: false, projectId: "proj_beta" });
    expect(textCalled).toBe(false);
  });

  it("resolves typed live names safely and supports an explicit no-default choice", async () => {
    const manual = await promptForProject(
      {
        async select() {
          return { kind: "manual" };
        },
        async text(options) {
          expect(options.initialValue).toBe("proj_old");
          expect(options.validate?.("Shared Name")).toMatch(/ambiguous/i);
          expect(options.validate?.("Alpha")).toBeUndefined();
          return "Alpha";
        },
        warn() {},
      },
      PROJECTS,
      undefined,
      "proj_old\u001b[2J",
    );
    expect(manual).toEqual({ cancelled: false, projectId: "proj_alpha" });

    const none = await promptForProject(
      {
        async select(): Promise<ProjectPickerChoice> {
          return { kind: "none" };
        },
        async text() {
          throw new Error("not reached");
        },
        warn() {},
      },
      PROJECTS,
      undefined,
      "proj_alpha",
    );
    expect(none).toEqual({ cancelled: false, projectId: undefined });
  });

  it("warns and accepts only a trimmed manual id when discovery fails or is empty", async () => {
    const warnings: string[] = [];
    const offline = await promptForProject(
      {
        async select() {
          throw new Error("not reached");
        },
        async text(options) {
          expect(options.message).toMatch(/project id/i);
          expect(options.initialValue).toBe("proj_offline_old");
          return "  proj_offline  ";
        },
        warn(message) {
          warnings.push(message);
        },
      },
      undefined,
      "network unavailable\u001b[2J",
      "proj_offline_old\u001b[2J",
    );
    expect(offline).toEqual({ cancelled: false, projectId: "proj_offline" });
    expect(warnings[0]).toMatch(/names cannot be resolved offline/i);
    expect(warnings[0]).not.toContain("\u001b");

    expect(normalizeOfflineProjectId("   ")).toBeUndefined();
  });

  it("persists the canonical selection, preserves profiles, and removes an explicit no-default", () => {
    const selected = buildInitConfig(
      { projectId: "proj_old", profiles: { work: { projectId: "proj_profile" } } },
      {
        apiKey: "capy_key",
        storeApiKey: false,
        projectId: "proj_alpha",
        orgId: "",
        authorEmail: "",
        defaultModel: "model-live",
      },
    );
    expect(selected.projectId).toBe("proj_alpha");
    expect(selected.profiles).toEqual({ work: { projectId: "proj_profile" } });
    expect(selected.apiKey).toBeUndefined();

    const none = buildInitConfig(selected, {
      apiKey: "capy_key",
      storeApiKey: true,
      projectId: undefined,
      orgId: "org_1",
      authorEmail: "you@example.com",
      defaultModel: "model-live",
    });
    expect(none.projectId).toBeUndefined();
    expect(none.apiKey).toBe("capy_key");
  });
});
