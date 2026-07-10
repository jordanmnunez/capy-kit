import { z, ZodError } from "zod";

import { CapyError } from "../client/errors.js";
import type { CapyContext } from "../client/context.js";

// effect records operation semantics for shell adapters and future MCP annotations.
// Transport retry safety is declared independently on each HTTP request.
export type Effect = "read" | "create" | "mutate" | "destroy";

export interface OpSpec<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string; // canonical resource.verb — "threads.list", "delegate", "wait"
  summary: string; // one-line: CLI help / MCP description / skill table row
  description?: string;
  input: I; // zod — single source of CLI flags, validation, and future MCP inputSchema
  output: O; // zod — typed result, boundary validation, and future MCP outputSchema
  effect: Effect;
  run(args: z.infer<I>, ctx: CapyContext): Promise<z.infer<O>>;
}

/** A typed op. Methods (not function-typed props) keep these assignable to `Op` for the registry. */
export interface TypedOp<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;
  summary: string;
  description?: string;
  input: I;
  output: O;
  effect: Effect;
  run(args: z.infer<I>, ctx: CapyContext): Promise<z.infer<O>>;
}

/** Type-erased op for the registry and its current/future adapters. */
export type Op = TypedOp<z.ZodTypeAny, z.ZodTypeAny>;

function zodToCapyError(e: ZodError, kind: "input" | "output"): CapyError {
  const issue = e.issues[0];
  const where = issue && issue.path.length ? ` at \`${issue.path.join(".")}\`` : "";
  const detail = issue ? `${issue.message}${where}` : "validation failed";
  return new CapyError({
    code: kind === "input" ? "validation_error" : "bad_response",
    message: kind === "input" ? `Invalid arguments: ${detail}` : `Unexpected response shape: ${detail}`,
    details: e.issues,
  });
}

/** Parse a shell/SDK value through an Op input schema with the standard Capy error envelope. */
export function parseInput<I extends z.ZodTypeAny>(schema: I, value: unknown): z.infer<I> {
  try {
    return schema.parse(value) as z.infer<I>;
  } catch (e) {
    if (e instanceof ZodError) throw zodToCapyError(e, "input");
    throw e;
  }
}

/**
 * Wrap an op spec. Input is ALWAYS parsed (coerces CLI string flags + validates SDK/MCP
 * args, mapping ZodError -> CapyError('validation_error')). Output is parsed only when
 * `ctx.validate` is on (the response-boundary toggle), mapping failures -> 'bad_response'.
 */
export function defineOp<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(spec: OpSpec<I, O>): TypedOp<I, O> {
  return {
    name: spec.name,
    summary: spec.summary,
    description: spec.description,
    input: spec.input,
    output: spec.output,
    effect: spec.effect,
    async run(args: z.infer<I>, ctx: CapyContext): Promise<z.infer<O>> {
      const parsed = parseInput(spec.input, args);
      const result = await spec.run(parsed, ctx);
      if (!ctx.validate) return result;
      try {
        return spec.output.parse(result) as z.infer<O>;
      } catch (e) {
        if (e instanceof ZodError) throw zodToCapyError(e, "output");
        throw e;
      }
    },
  };
}

/** Comma-separated OR real-array input (CLI `--tag a,b` and SDK/MCP `["a","b"]` both work). */
export function csvArray<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => {
    if (typeof v === "string") {
      return v
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return v;
  }, z.array(inner));
}
