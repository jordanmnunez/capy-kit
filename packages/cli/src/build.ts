import {
  CapyError,
  exitCodeFor,
  pollUntilTerminal,
  render,
  resolveContext,
  WAIT_BLOCKED_EXIT_CODE,
  WAIT_TIMEOUT_EXIT_CODE,
  type CapyContext,
  type Op,
  type OutputFormat,
  type WaitResult,
} from "@capy-kit/core";
import type { ArgDef, ArgsDef, CommandDef } from "citty";

// Structural view of a zod schema — lets the CLI introspect op inputs without depending
// on zod itself (zod is core's concern). Verified shape against zod v4: `.def.type`,
// `.unwrap()`, and `.shape` are all present.
interface SchemaNode {
  def?: { type?: string };
  description?: string;
  unwrap?: () => SchemaNode;
  shape?: Record<string, SchemaNode>;
}

// Globals available on every leaf command (citty doesn't inherit args, so we merge these in).
export const globalArgs = {
  json: { type: "boolean", description: "Output JSON instead of human-readable text." },
  project: { type: "string", description: "Project id (defaults to CAPY_PROJECT_ID / config)." },
  org: { type: "string", description: "Org id (defaults to CAPY_ORG_ID / config)." },
  profile: { type: "string", description: "Named config profile to use." },
  debug: { type: "boolean", description: "Log redacted requests/responses to stderr." },
} satisfies ArgsDef;

// CLI fields that map to positionals, and op-input keys covered by a global flag (so we
// don't emit a redundant --projectId alongside --project).
const POSITIONALS: Readonly<Record<string, string[]>> = {
  delegate: ["prompt"],
  "threads.get": ["id"],
  "threads.message": ["id", "message"],
  "threads.messages": ["id"],
  "projects.get": ["id"],
  wait: ["id"],
};
const SKIP_FLAGS: ReadonlySet<string> = new Set(["projectId"]);

function unwrapToBase(schema: SchemaNode): SchemaNode {
  let s = schema;
  while (s && typeof s.unwrap === "function" && ["optional", "nullable", "default", "readonly"].includes(s.def?.type ?? "")) {
    s = s.unwrap();
  }
  return s;
}

function isOptional(schema: SchemaNode): boolean {
  return schema.def?.type === "optional";
}

function isBoolean(schema: SchemaNode): boolean {
  return unwrapToBase(schema).def?.type === "boolean";
}

/** A zod `.describe(...)` on the field (or its unwrapped base) -> citty help text. */
function descriptionOf(schema: SchemaNode): string | undefined {
  return schema.description ?? unwrapToBase(schema).description;
}

/** Project an op's zod input into citty args: booleans -> flags, positionals via map, rest -> string (zod coerces). */
export function argsForOp(op: Op): ArgsDef {
  const shape = (op.input as unknown as SchemaNode).shape ?? {};
  const positionals = POSITIONALS[op.name] ?? [];
  const args: Record<string, ArgDef> = {};
  for (const [key, field] of Object.entries(shape)) {
    if (SKIP_FLAGS.has(key)) continue;
    const desc = descriptionOf(field);
    const description = desc ? { description: desc } : {};
    if (positionals.includes(key)) {
      args[key] = { type: "positional", required: !isOptional(field), ...description };
    } else if (isBoolean(field)) {
      args[key] = { type: "boolean", ...description };
    } else {
      args[key] = { type: "string", ...description };
    }
  }
  return args;
}

export function formatOf(args: Record<string, unknown>): OutputFormat {
  return args.json ? "json" : "human";
}

/** Parse an optional numeric CLI flag. Rejects non-finite (e.g. "abc" -> NaN) -> undefined. */
export function numOpt(v: unknown): number | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function buildCtx(args: Record<string, unknown>): CapyContext {
  const debug = Boolean(args.debug);
  return resolveContext(
    {
      projectId: typeof args.project === "string" ? args.project : undefined,
      orgId: typeof args.org === "string" ? args.org : undefined,
      onRequest: debug
        ? (req) => process.stderr.write(`→ ${req.method} ${req.url}\n`)
        : undefined,
      onResponse: debug ? (res) => process.stderr.write(`← ${res.status} ${res.url}\n`) : undefined,
    },
    { profile: typeof args.profile === "string" ? args.profile : undefined },
  );
}

export function emit(opName: string, result: unknown, fmt: OutputFormat): void {
  process.stdout.write(render(opName, result, fmt) + "\n");
}

/**
 * If a delegate/message call failed because a --tags value doesn't exist yet, append the
 * fix. Tags must pre-exist in the Capy project; capy-kit never auto-creates them (that
 * convenience, if ever wanted, is fleet-hq's, not core's).
 */
export function withTagsHint(e: unknown, hadTags: boolean): unknown {
  if (hadTags && e instanceof CapyError && e.code === "validation_error" && /tag/i.test(e.message)) {
    return new CapyError({
      code: e.code,
      message: `${e.message} — tags must already exist in the Capy project (create them in the Capy app, or omit --tags).`,
      requestId: e.requestId,
      details: e.details,
    });
  }
  return e;
}

/** Print an error in the chosen mode and set a code-mapped exit code. Never rethrows. */
export function fail(e: unknown, fmt: OutputFormat): void {
  const err =
    e instanceof CapyError
      ? e
      : new CapyError({ code: "api_error", message: e instanceof Error ? e.message : String(e) });
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(err.toEnvelope(), null, 2) + "\n");
  } else {
    process.stderr.write(`capy: ${err.message}${err.requestId ? ` (request ${err.requestId})` : ""}\n`);
  }
  process.exitCode = exitCodeFor(err.code);
}

/**
 * Exit code for a finished poll (the poll itself succeeded — genuine API errors go through
 * `fail`). 0 = done; WAIT_BLOCKED_EXIT_CODE (123) = blocked, needs you; WAIT_TIMEOUT_EXIT_CODE
 * (124) = poll budget ran out. Lets scripts branch on needs-you vs ran-out vs done.
 */
export function waitExitCode(result: WaitResult): number {
  if (result.terminal) return 0;
  if (result.timedOut) return WAIT_TIMEOUT_EXIT_CODE;
  return WAIT_BLOCKED_EXIT_CODE; // settled but not done -> blocked on a human/integration gate
}

/**
 * Drive a thread to settle, streaming progress to stderr (human) and returning the final
 * WaitResult. Shared by `capy wait` and `capy delegate --wait`. Exit code via waitExitCode:
 * 0 done / 123 blocked-needs-you / 124 timed out.
 */
export async function driveWait(
  ctx: CapyContext,
  opts: { id: string; timeoutSec?: number; intervalSec?: number },
  fmt: OutputFormat,
  behavior: { emitFinal?: boolean } = {},
): Promise<WaitResult> {
  const emitFinal = behavior.emitFinal ?? true;
  const gen = pollUntilTerminal(ctx, {
    id: opts.id,
    timeoutMs: opts.timeoutSec !== undefined ? opts.timeoutSec * 1000 : undefined,
    intervalMs: opts.intervalSec !== undefined ? opts.intervalSec * 1000 : undefined,
  });
  let next = await gen.next();
  while (!next.done) {
    const tick = next.value;
    if (fmt === "human") {
      const waiting = tick.waitingOn.length ? ` waitingOn=${tick.waitingOn.join(",")}` : "";
      process.stderr.write(
        `waiting… runState=${tick.runState} status=${tick.status}${waiting} (${Math.round(tick.elapsedMs / 1000)}s)\n`,
      );
    }
    next = await gen.next();
  }
  const result = next.value;
  if (emitFinal) emit("wait", result, fmt);
  const code = waitExitCode(result);
  if (code !== 0) process.exitCode = code;
  return result;
}

/** Generic command: a thin projection of one op (used for read ops with no extra sugar). */
export function opCommand(op: Op): CommandDef {
  return {
    meta: { name: op.name.split(".").pop() ?? op.name, description: op.summary },
    args: { ...argsForOp(op), ...globalArgs },
    async run({ args }) {
      const fmt = formatOf(args);
      try {
        const result = await op.run(args as Record<string, unknown>, buildCtx(args));
        emit(op.name, result, fmt);
      } catch (e) {
        fail(e, fmt);
      }
    },
  };
}
