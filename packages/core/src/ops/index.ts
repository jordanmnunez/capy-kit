import type { CapyContext } from "../client/context.js";
import { delegate } from "./delegate.js";
import type { Op } from "./define.js";
import { pollUntilTerminal, wait, waitForThread } from "./poll.js";
import { projectsGet, projectsList } from "./projects.js";
import { status } from "./status.js";
import { listAllThreads, threadsGet, threadsList } from "./threads.js";

/**
 * The single registry every surface projects from. Add one op here -> it appears in the
 * CLI tree, the MCP tool roster, and the generated skill tables. Order is the display order.
 */
export const OPS: Op[] = [delegate, threadsList, threadsGet, wait, status, projectsList, projectsGet];

export const opsByName: Readonly<Record<string, Op>> = Object.freeze(
  Object.fromEntries(OPS.map((op) => [op.name, op])),
);

// Ergonomic, ctx-first SDK surface (matches SPEC: `ops.delegate(ctx, { … })`).
export const ops = {
  delegate: (ctx: CapyContext, args: Parameters<typeof delegate.run>[0]) => delegate.run(args, ctx),
  threadsList: (ctx: CapyContext, args: Parameters<typeof threadsList.run>[0]) => threadsList.run(args, ctx),
  threadsGet: (ctx: CapyContext, args: Parameters<typeof threadsGet.run>[0]) => threadsGet.run(args, ctx),
  wait: (ctx: CapyContext, args: Parameters<typeof wait.run>[0]) => wait.run(args, ctx),
  status: (ctx: CapyContext, args: Parameters<typeof status.run>[0]) => status.run(args, ctx),
  projectsList: (ctx: CapyContext, args: Parameters<typeof projectsList.run>[0]) => projectsList.run(args, ctx),
  projectsGet: (ctx: CapyContext, args: Parameters<typeof projectsGet.run>[0]) => projectsGet.run(args, ctx),
  // generators / helpers (no zod boundary; advanced/streaming use)
  pollUntilTerminal,
  waitForThread,
  listAllThreads,
} as const;

export { delegate, threadsList, threadsGet, wait, status, projectsList, projectsGet, listAllThreads, pollUntilTerminal, waitForThread };
export type { PollTick, WaitResult, PollOptions } from "./poll.js";
