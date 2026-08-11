import { CapyError, exitCodeFor, resolveContext, render, sanitizeTerminalText, type Op, type OutputFormat } from "@capy-kit/core";
import type { ArgsDef, CommandDef } from "citty";

export const globalArgs = { json: { type: "boolean" }, debug: { type: "boolean" }, project: { type: "string" } } satisfies ArgsDef;

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
  for (const [k, v] of Object.entries(s)) a[k] = { type: k === "id" || k === "message" || k === "text" || k === "requestId" ? "positional" : (v as any).def?.type === "boolean" ? "boolean" : "string", required: (v as any).def?.type !== "optional" };
  return a;
}
export function opCommand(op: Op): CommandDef {
  return { meta: { name: op.name.split(".").pop()!, description: op.summary }, args: { ...argsForOp(op), ...globalArgs }, async run({ args }) { const f = formatOf(args); try { const out = await op.run(args as any, buildCtx(args)); process.stdout.write(render(op.name, out, f) + "\n"); } catch (e) { fail(e, f); } } };
}
