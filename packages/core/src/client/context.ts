import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { CapyError } from "./errors.js";

// Resolved, ready-to-use context. Every op takes one of these. project/org are
// optional here and resolved per-call (`arg ?? ctx.projectId ?? …`) so one client
// drives many projects. `fetch` is injectable for tests / MCP (network-free ops).
export interface CapyContext {
  apiKey: string;
  baseUrl: string;
  projectId?: string;
  authorId?: string;
  fetch: typeof fetch;
  validate: boolean;
  timeoutMs: number;
  maxRetries: number;
  onRequest?: (req: Request) => void;
  onResponse?: (res: Response) => void;
}

export interface CapyContextInput {
  apiKey?: string;
  baseUrl?: string;
  projectId?: string;
  authorId?: string;
  fetch?: typeof fetch;
  validate?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  onRequest?: (req: Request) => void;
  onResponse?: (res: Response) => void;
}

export const DEFAULTS = {
  baseUrl: "https://api.capy.ai/api/v1",
  validate: false,
  timeoutMs: 60_000,
  maxRetries: 2,
} as const;

export interface CapyConfigLayer {
  apiKey?: string;
  baseUrl?: string;
  projectId?: string;
  authorId?: string;
}

export interface CapyConfigDocument extends CapyConfigLayer {
  profiles?: Record<string, CapyConfigLayer>;
  projects?: Record<string, string>;
  defaultProject?: string;
  [key: string]: unknown;
}

const CONFIG_STRING_FIELDS = [
  "apiKey",
  "baseUrl",
  "projectId",
  "authorId",
] as const satisfies ReadonlyArray<keyof CapyConfigLayer>;

function firstString(...vals: Array<unknown>): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function toInt(v: unknown): number | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v !== "string") return undefined;
  if (/^(1|true|yes|on)$/i.test(v)) return true;
  if (/^(0|false|no|off)$/i.test(v)) return false;
  return undefined;
}

function assertPrivateFile(path: string): void {
  if (process.platform !== "win32" && (statSync(path).mode & 0o077) !== 0) {
    throw new CapyError({
      code: "validation_error",
      message: `Refusing to read ${path}: it is accessible by group/other users. Run \`chmod 600 ${path}\`.`,
    });
  }
}

function isErrno(e: unknown, code: string): boolean {
  return e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === code;
}

function configError(message: string, cause?: unknown): CapyError {
  return new CapyError({ code: "validation_error", message, cause });
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw configError(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function validateConfigLayer(value: unknown, label: string): Record<string, unknown> {
  const record = requireObject(value, label);
  for (const key of CONFIG_STRING_FIELDS) {
    if (record[key] !== undefined && typeof record[key] !== "string") {
      throw configError(`${label}.${key} must be a string when present.`);
    }
  }
  return record;
}

/** Read and validate ~/.capy/config.json. Only a genuinely missing file is treated as absent. */
export function readCapyConfig(): CapyConfigDocument | undefined {
  const path = join(homedir(), ".capy", "config.json");
  let raw: string;
  try {
    assertPrivateFile(path);
    raw = readFileSync(path, "utf8");
  } catch (e) {
    if (e instanceof CapyError) throw e;
    if (isErrno(e, "ENOENT")) return undefined;
    throw configError(`Unable to read ${path}: ${e instanceof Error ? e.message : String(e)}.`, e);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    throw configError(`Invalid ${path}: malformed JSON.`, e);
  }

  const document = validateConfigLayer(parsed, path);
  const rawProjects = document.projects;
  if (rawProjects !== undefined) {
    const projects = requireObject(rawProjects, `${path}.projects`);
    for (const [name, id] of Object.entries(projects)) {
      if (!name.trim() || typeof id !== "string" || !id.trim()) throw configError(`${path}.projects entries must map non-empty names to ids.`);
    }
  }
  if (document.defaultProject !== undefined && typeof document.defaultProject !== "string") {
    throw configError(`${path}.defaultProject must be a string when present.`);
  }
  if (document.defaultProject !== undefined && !(document.projects as Record<string, string> | undefined)?.[document.defaultProject]) {
    throw configError(`${path}.defaultProject must name an entry in ${path}.projects.`);
  }
  const rawProfiles = document.profiles;
  if (rawProfiles === undefined) return document as CapyConfigDocument;

  const profilesRecord = requireObject(rawProfiles, `${path}.profiles`);
  const profiles = Object.create(null) as Record<string, CapyConfigLayer>;
  for (const [name, value] of Object.entries(profilesRecord)) {
    profiles[name] = validateConfigLayer(value, `${path}.profiles.${name}`) as CapyConfigLayer;
  }
  return { ...document, profiles } as CapyConfigDocument;
}

function resolveProjectReference(value: string | undefined, document: CapyConfigDocument | undefined): string | undefined {
  if (!value) return undefined;
  return document?.projects?.[value] ?? value;
}

/** Select the top-level file layer or merge an explicitly requested profile over it. */
function readConfigFile(document: CapyConfigDocument | undefined, profile?: string): { file: CapyConfigLayer; profileSelected: boolean } {
  if (profile === undefined) return { file: document ?? {}, profileSelected: false };

  const name = profile.trim();
  if (!name) throw configError("A non-empty config profile name is required.");
  if (!document || !document.profiles || !Object.hasOwn(document.profiles, name)) {
    throw configError(`Config profile \"${name}\" was requested but does not exist in ~/.capy/config.json.`);
  }
  return { file: { ...document, ...document.profiles[name] }, profileSelected: true };
}

/** ~/.capy/.env — minimal KEY=VALUE parser for CAPY_* vars (no shell expansion). */
function readDotEnv(): Record<string, string> {
  try {
    const path = join(homedir(), ".capy", ".env");
    assertPrivateFile(path);
    const raw = readFileSync(path, "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || !m[1]) continue;
      let val = (m[2] ?? "").trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
    return out;
  } catch (e) {
    if (e instanceof CapyError) throw e;
    if (isErrno(e, "ENOENT")) return {};
    const path = join(homedir(), ".capy", ".env");
    throw configError(`Unable to read ${path}: ${e instanceof Error ? e.message : String(e)}.`, e);
  }
}

/**
 * Build a CapyContext. Ordinary precedence (low -> high):
 *   DEFAULTS < ~/.capy/config.json < ~/.capy/.env < process.env (CAPY_*) < explicit input.
 * Project and author identity fail closed for an explicit profile:
 *   explicit input > effective profile config (profile over top-level), ignoring ambient identity vars.
 * Never throws on a missing key — transport raises `no_api_key` only when a request is attempted.
 */
export function resolveContext(input: CapyContextInput = {}, opts?: { profile?: string }): CapyContext {
  const document = readCapyConfig();
  const selection = readConfigFile(document, opts?.profile);
  const file = selection.file;
  const dot = readDotEnv();
  const env = process.env;

  const pick = (key: `CAPY_${string}`, fileVal?: string): string | undefined =>
    firstString(env[key], dot[key], fileVal);

  return {
    apiKey: input.apiKey ?? firstString(env.CAPY_API_KEY, dot.CAPY_API_KEY, file.apiKey) ?? "",
    baseUrl: input.baseUrl ?? pick("CAPY_BASE_URL", file.baseUrl) ?? DEFAULTS.baseUrl,
    projectId: resolveProjectReference(
      input.projectId ?? (selection.profileSelected ? firstString(file.projectId) : pick("CAPY_PROJECT_ID", file.projectId)) ?? document?.projects?.[document.defaultProject ?? ""],
      document,
    ),
    authorId: input.authorId ?? (selection.profileSelected ? firstString(file.authorId) : pick("CAPY_AUTHOR_ID", file.authorId)),
    fetch: input.fetch ?? globalThis.fetch,
    validate: input.validate ?? toBool(env.CAPY_VALIDATE ?? dot.CAPY_VALIDATE) ?? DEFAULTS.validate,
    timeoutMs: input.timeoutMs ?? toInt(env.CAPY_TIMEOUT_MS ?? dot.CAPY_TIMEOUT_MS) ?? DEFAULTS.timeoutMs,
    maxRetries: input.maxRetries ?? toInt(env.CAPY_MAX_RETRIES ?? dot.CAPY_MAX_RETRIES) ?? DEFAULTS.maxRetries,
    onRequest: input.onRequest,
    onResponse: input.onResponse,
  };
}
