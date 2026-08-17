import { CapyError, exitCodeFor, resolveContext, render, sanitizeTerminalText, type Op, type OutputFormat } from "@capy-kit/core";
import type { ArgsDef, CommandDef } from "citty";

export const globalArgs = { json: { type: "boolean" }, debug: { type: "boolean" }, project: { type: "string" } } satisfies ArgsDef;

const MODEL_OPS = new Set(["delegate", "threads.message"]);
const CLEARABLE_TITLE_OPS = new Set(["threads.rename"]);

const modelArgs = {
  modelId: { type: "string", description: "Capy model identifier." },
  reasoningMode: { type: "string", description: "Model reasoning mode." },
  fast: { type: "boolean", description: "Enable the model's fast mode." },
  pro: { type: "boolean", description: "Enable the model's pro mode." },
} satisfies ArgsDef;

const clearTitleArgs = {
  clearTitle: { type: "boolean", description: "Clear the custom title and let Capy generate one." },
} satisfies ArgsDef;

export function buildCtx(a: Record<string, unknown>) {
  return resolveContext({
    projectId: typeof a.project === "string" ? a.project : undefined,
    onRequest: a.debug ? (r) => process.stderr.write(`→ ${r.method} ${r.url}\n`) : undefined,
    onResponse: a.debug ? (r) => process.stderr.write(`← ${r.status} ${r.url}\n`) : undefined,
  });
}

export const formatOf = (a: Record<string, unknown>): OutputFormat => a.json ? "json" : "human";
export function fail(e: unknown, f: OutputFormat) {
  const x = e instanceof CapyError ? e : new CapyError({ code: "api_error", message: e instanceof Error ? e.message : String(e) });
  (f === "json" ? process.stdout : process.stderr).write(f === "json" ? JSON.stringify(x.toEnvelope(), null, 2) + "\n" : `capy: ${sanitizeTerminalText(x.message)}\n`);
  process.exitCode = exitCodeFor(x.code);
}
export function argsForOp(op: Op): ArgsDef {
  const s = (op.input as any).shape ?? {}; const a: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (MODEL_OPS.has(op.name) && k === "model") continue;
    if (CLEARABLE_TITLE_OPS.has(op.name) && k === "title") {
      a.title = { type: "string" };
      continue;
    }
    a[k] = { type: k === "id" || k === "message" || k === "text" || k === "requestId" ? "positional" : (v as any).def?.type === "boolean" ? "boolean" : "string", required: (v as any).def?.type !== "optional" };
  }
  if (MODEL_OPS.has(op.name)) Object.assign(a, modelArgs);
  if (CLEARABLE_TITLE_OPS.has(op.name)) Object.assign(a, clearTitleArgs);
  return a;
}

/** Convert shell-only flags into the exact nested API request shape. */
export function apiArgsForOp(op: Op, args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args };
  if (MODEL_OPS.has(op.name)) {
    const { modelId, reasoningMode, fast, pro } = next;
    delete next.modelId; delete next.reasoningMode; delete next.fast; delete next.pro;
    if (modelId !== undefined || reasoningMode !== undefined || fast !== undefined || pro !== undefined) {
      const modes = fast !== undefined || pro !== undefined ? { ...(fast !== undefined ? { fast } : {}), ...(pro !== undefined ? { pro } : {}) } : undefined;
      next.model = { ...(modelId !== undefined ? { modelId } : {}), ...(reasoningMode !== undefined ? { reasoningMode } : {}), ...(modes ? { modes } : {}) };
    }
  }
  if (CLEARABLE_TITLE_OPS.has(op.name)) {
    const clearTitle = next.clearTitle;
    delete next.clearTitle;
    if (clearTitle && next.title !== undefined) {
      throw new CapyError({ code: "validation_error", message: "Use either --title or --clear-title, not both." });
    }
    if (clearTitle) next.title = null;
  }
  return next;
}
export function opCommand(op: Op): CommandDef {
  return { meta: { name: op.name.split(".").pop()!, description: op.summary }, args: { ...argsForOp(op), ...globalArgs }, async run({ args }) { const f = formatOf(args); try { const out = await op.run(apiArgsForOp(op, args as Record<string, unknown>) as any, buildCtx(args)); process.stdout.write(render(op.name, out, f) + "\n"); } catch (e) { fail(e, f); } } };
}
