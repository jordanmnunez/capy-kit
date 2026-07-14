import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  CapyError,
  DEFAULTS,
  DEFAULT_MODEL,
  REASONING_MODES,
  modelsList,
  projectsList,
  readCapyConfig,
  resolveContext,
  sanitizeTerminalText,
  type CapyConfigDocument,
  type ProjectListItem,
} from "@capy-kit/core";
import type { Option } from "@clack/prompts";
import type { CommandDef } from "citty";

import { fail } from "../build.js";

// Short-timeout fallback only; the normal picker is populated from the models.list Op.
const MODEL_FALLBACK_CHOICES = [
  { value: DEFAULT_MODEL, label: `${DEFAULT_MODEL} (offline fallback)` },
  { value: "gpt-5.6-sol", label: "gpt-5.6-sol" },
  { value: "gpt-5.6-terra", label: "gpt-5.6-terra" },
  { value: "claude-fable-5", label: "claude-fable-5" },
  { value: "claude-sonnet-5", label: "claude-sonnet-5" },
  { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
];

const REASONING_CHOICES = REASONING_MODES.map((mode) => ({ value: mode, label: mode }));

export type ProjectIdentity = Pick<ProjectListItem, "id" | "name" | "taskCode" | "repos">;

export type ProjectPickerChoice =
  | { kind: "project"; projectId: string }
  | { kind: "manual" }
  | { kind: "none" };

export type ProjectPickerOption = Option<ProjectPickerChoice>;

interface ProjectPromptAdapter {
  select(options: {
    message: string;
    options: ProjectPickerOption[];
    initialValue: ProjectPickerChoice;
  }): Promise<ProjectPickerChoice | symbol>;
  text(options: {
    message: string;
    placeholder?: string;
    initialValue: string;
    validate?: (value: string) => string | Error | undefined;
  }): Promise<string | symbol>;
  warn(message: string): void;
}

export type ProjectPromptResult =
  | { cancelled: true }
  | { cancelled: false; projectId: string | undefined };

export function projectPickerOptions(projects: ProjectIdentity[]): ProjectPickerOption[] {
  return [
    ...projects.map((project) => {
      const repos = project.repos.map((repo) => `${repo.repoFullName}@${repo.branch}`).join(", ");
      return {
        value: { kind: "project", projectId: project.id } as const,
        label: sanitizeTerminalText(project.name),
        hint: sanitizeTerminalText(`${project.taskCode} · ${repos || "no repos"} · ${project.id}`),
      };
    }),
    { value: { kind: "manual" }, label: "Enter an exact project id or name" },
    { value: { kind: "none" }, label: "No default project" },
  ];
}

export function initialProjectChoice(
  options: ProjectPickerOption[],
  configuredProjectId: string | undefined,
): ProjectPickerChoice {
  if (configuredProjectId) {
    const match = options.find(
      (option) => option.value.kind === "project" && option.value.projectId === configuredProjectId,
    );
    if (match) return match.value;
    const manual = options.find((option) => option.value.kind === "manual");
    if (manual) return manual.value;
  }
  const none = options.find((option) => option.value.kind === "none");
  if (!none) throw new Error("project picker requires a no-default option");
  return none.value;
}

/** Resolve a live project id or exact case-insensitive name; never guess among duplicates. */
export function resolveLiveProjectInput(input: string, projects: ProjectIdentity[]): string | undefined {
  const value = input.trim();
  if (!value) return undefined;

  const byId = projects.find((project) => project.id === value);
  if (byId) return byId.id;

  const normalized = value.toLocaleLowerCase();
  const matches = new Map(
    projects
      .filter((project) => project.name.trim().toLocaleLowerCase() === normalized)
      .map((project) => [project.id, project]),
  );
  if (matches.size === 1) return matches.values().next().value?.id;
  if (matches.size > 1) {
    throw new CapyError({
      code: "validation_error",
      message:
        `Project name \"${value}\" is ambiguous; matching ids: ${[...matches.keys()].join(", ")}. ` +
        "Choose a listed project or enter its exact id.",
    });
  }
  throw new CapyError({
    code: "validation_error",
    message: `No visible project has id or exact name \"${value}\". Choose a listed project.`,
  });
}

export function normalizeOfflineProjectId(input: string): string | undefined {
  return input.trim() || undefined;
}

export async function promptForProject(
  prompts: ProjectPromptAdapter,
  projects: ProjectIdentity[] | undefined,
  discoveryError: string | undefined,
  configuredProjectId: string | undefined,
): Promise<ProjectPromptResult> {
  if (projects && projects.length > 0) {
    const options = projectPickerOptions(projects);
    const choice = await prompts.select({
      message: "Default Capy project",
      options,
      initialValue: initialProjectChoice(options, configuredProjectId),
    });
    if (typeof choice === "symbol") return { cancelled: true };
    if (choice.kind === "project") return { cancelled: false, projectId: choice.projectId };
    if (choice.kind === "none") return { cancelled: false, projectId: undefined };

    const manual = await prompts.text({
      message: "Exact project id or name (blank for no default)",
      placeholder: "Project name or canonical id",
      initialValue: sanitizeTerminalText(configuredProjectId ?? ""),
      validate(value) {
        try {
          resolveLiveProjectInput(value, projects);
          return undefined;
        } catch (e) {
          return errorMessage(e);
        }
      },
    });
    if (typeof manual === "symbol") return { cancelled: true };
    return { cancelled: false, projectId: resolveLiveProjectInput(manual, projects) };
  }

  const safeDiscoveryError = discoveryError ? sanitizeTerminalText(discoveryError) : undefined;
  prompts.warn(
    safeDiscoveryError
      ? `Live project discovery failed (${safeDiscoveryError}). Enter a canonical project id; names cannot be resolved offline.`
      : "Live project discovery returned no projects. Enter a canonical project id manually.",
  );
  const manual = await prompts.text({
    message: "Default project id (optional; live names unavailable)",
    placeholder: "Canonical project id",
    initialValue: sanitizeTerminalText(configuredProjectId ?? ""),
  });
  if (typeof manual === "symbol") return { cancelled: true };
  return { cancelled: false, projectId: normalizeOfflineProjectId(manual) };
}

interface InitConfigAnswers {
  apiKey: string;
  storeApiKey: boolean;
  projectId: string | undefined;
  orgId: string;
  authorEmail: string;
  defaultModel: string;
  defaultReasoning: string;
  defaultBuildModel: string;
  defaultBuildReasoning: string;
}

export function buildInitConfig(
  existing: CapyConfigDocument,
  answers: InitConfigAnswers,
): CapyConfigDocument {
  const cfg: CapyConfigDocument = {
    ...existing,
    defaultModel: answers.defaultModel,
    defaultReasoning: answers.defaultReasoning,
    defaultBuildModel: answers.defaultBuildModel,
    defaultBuildReasoning: answers.defaultBuildReasoning,
  };
  if (answers.storeApiKey) cfg.apiKey = answers.apiKey;
  else delete cfg.apiKey;
  if (answers.projectId) cfg.projectId = answers.projectId;
  else delete cfg.projectId;
  if (answers.orgId.trim()) cfg.orgId = answers.orgId.trim();
  if (answers.authorEmail.trim()) cfg.authorEmail = answers.authorEmail.trim();
  return cfg;
}

function errorMessage(error: unknown): string {
  return sanitizeTerminalText(error instanceof Error ? error.message : String(error));
}

function initialChoice(
  choices: ReadonlyArray<{ value: string }>,
  configured: string | undefined,
  fallback: string,
): string {
  if (configured && choices.some((choice) => choice.value === configured)) return configured;
  if (choices.some((choice) => choice.value === fallback)) return fallback;
  return choices[0]!.value;
}

export function initDiscoveryContext(apiKey: string) {
  // A newly typed credential must only be sent to Capy's canonical API. Ordinary
  // commands may use CAPY_BASE_URL for proxies/testing; init discovery does not.
  return resolveContext({
    apiKey,
    baseUrl: DEFAULTS.baseUrl,
    timeoutMs: 5_000,
    maxRetries: 0,
    validate: true,
  });
}

async function runInit(): Promise<void> {
  if (!process.stdin.isTTY) {
    process.stderr.write(
      "capy init needs an interactive terminal.\n" +
        "Non-interactive setup: set CAPY_API_KEY (and optionally CAPY_PROJECT_ID / CAPY_ORG_ID).\n",
    );
    process.exitCode = 1;
    return;
  }

  const p = await import("@clack/prompts");
  p.intro("capy init");

  const apiKey = await p.password({
    message: "Capy API key (capy_…) — create at capy.ai/settings/tokens",
    validate: (value) => (value && value.length > 0 ? undefined : "Required"),
  });
  if (p.isCancel(apiKey)) return p.cancel("Cancelled.");

  const store = await p.confirm({
    message: "Store the key in ~/.capy/config.json (0600)? (No → use the CAPY_API_KEY env var)",
    initialValue: false,
  });
  if (p.isCancel(store)) return p.cancel("Cancelled.");

  const existing = readCapyConfig() ?? {};
  const discoveryContext = initDiscoveryContext(apiKey);
  const [projectDiscovery, modelDiscovery] = await Promise.allSettled([
    projectsList.run({ all: true }, discoveryContext),
    modelsList.run({}, discoveryContext),
  ]);

  const projectResult = await promptForProject(
    {
      select: (options) => p.select(options),
      text: (options) => p.text(options),
      warn: (message) => p.log.warn(message),
    },
    projectDiscovery.status === "fulfilled" ? projectDiscovery.value.items : undefined,
    projectDiscovery.status === "rejected" ? errorMessage(projectDiscovery.reason) : undefined,
    typeof existing.projectId === "string" ? existing.projectId : undefined,
  );
  if (projectResult.cancelled) return p.cancel("Cancelled.");

  const orgId = await p.text({ message: "Org id for usage (optional)", placeholder: "org_…" });
  if (p.isCancel(orgId)) return p.cancel("Cancelled.");

  const authorEmail = await p.text({
    message: "Your email — defaults `capy status` to your own threads on shared projects (optional)",
    placeholder: "you@company.com",
  });
  if (p.isCancel(authorEmail)) return p.cancel("Cancelled.");

  let modelChoices = MODEL_FALLBACK_CHOICES;
  let buildModelChoices = MODEL_FALLBACK_CHOICES;
  if (modelDiscovery.status === "fulfilled") {
    const available = modelDiscovery.value.models.map((model) => ({
      value: model.id,
      label: sanitizeTerminalText(`${model.name} (${model.id}, ${model.provider})`),
    }));
    const eligible = modelDiscovery.value.models.filter((model) => model.captainEligible);
    if (eligible.length > 0) {
      modelChoices = eligible.map((model) => ({
        value: model.id,
        label: sanitizeTerminalText(`${model.name} (${model.id}, ${model.provider})`),
      }));
    }
    // The API reports Captain eligibility but not builder eligibility. Surface all live models
    // for builders and let the create-thread endpoint validate role/model support faithfully.
    if (available.length > 0) buildModelChoices = available;
  } else {
    p.log.warn(`Live model discovery failed (${errorMessage(modelDiscovery.reason)}); using the offline fallback list.`);
  }

  const configuredModel = typeof existing.defaultModel === "string" ? existing.defaultModel : undefined;
  const initialModel = initialChoice(modelChoices, configuredModel, DEFAULT_MODEL);

  const defaultModel = await p.select({
    message: "Default Captain model",
    options: modelChoices,
    initialValue: initialModel,
  });
  if (p.isCancel(defaultModel)) return p.cancel("Cancelled.");

  const configuredReasoning = typeof existing.defaultReasoning === "string" ? existing.defaultReasoning : undefined;
  const defaultReasoning = await p.select({
    message: "Default Captain reasoning effort",
    options: REASONING_CHOICES,
    initialValue: initialChoice(REASONING_CHOICES, configuredReasoning, "max"),
  });
  if (p.isCancel(defaultReasoning)) return p.cancel("Cancelled.");

  const configuredBuildModel =
    typeof existing.defaultBuildModel === "string" ? existing.defaultBuildModel : undefined;
  const defaultBuildModel = await p.select({
    message: "Default builder model",
    options: buildModelChoices,
    initialValue: initialChoice(buildModelChoices, configuredBuildModel, defaultModel),
  });
  if (p.isCancel(defaultBuildModel)) return p.cancel("Cancelled.");

  const configuredBuildReasoning =
    typeof existing.defaultBuildReasoning === "string" ? existing.defaultBuildReasoning : undefined;
  const defaultBuildReasoning = await p.select({
    message: "Default builder reasoning effort",
    options: REASONING_CHOICES,
    initialValue: initialChoice(REASONING_CHOICES, configuredBuildReasoning, defaultReasoning),
  });
  if (p.isCancel(defaultBuildReasoning)) return p.cancel("Cancelled.");

  const dir = join(homedir(), ".capy");
  const cfgPath = join(dir, "config.json");
  mkdirSync(dir, { recursive: true });
  const cfg = buildInitConfig(existing, {
    apiKey,
    storeApiKey: store,
    projectId: projectResult.projectId,
    orgId,
    authorEmail,
    defaultModel,
    defaultReasoning,
    defaultBuildModel,
    defaultBuildReasoning,
  });
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  chmodSync(cfgPath, 0o600);

  const keyNote = store ? "API key stored (0600)." : "API key NOT stored — export CAPY_API_KEY in your shell.";
  p.outro(sanitizeTerminalText(
    `Saved ${cfgPath}. Project ${projectResult.projectId ?? "not set"}. ${keyNote}`,
  ));
}

export const initCommand: CommandDef = {
  meta: { name: "init", description: "Interactive setup → ~/.capy/config.json (mode 0600)." },
  args: {},
  async run() {
    try {
      await runInit();
    } catch (error) {
      fail(error, "human");
    }
  },
};
