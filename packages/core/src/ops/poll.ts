import { z } from "zod";

import type { CapyContext } from "../client/context.js";
import { CapyError, isPermanent } from "../client/errors.js";
import { resources, type ThreadListItem } from "../client/resources.js";
import {
  THREAD_RUN_STATES,
  THREAD_STATUSES,
  isThreadDone,
  isThreadSettled,
  type ThreadRunState,
  type ThreadStatus,
} from "../model.js";
import { sleep } from "../util.js";
import { defineOp } from "./define.js";

export interface PollTick {
  id: string;
  status: ThreadStatus;
  runState: ThreadRunState;
  waitingOn: string[];
  blockedOn: string[];
  elapsedMs: number;
  attempt: number;
}

export interface WaitResult {
  id: string;
  status: ThreadStatus;
  runState: ThreadRunState;
  waitingOn: string[];
  blockedOn: string[];
  terminal: boolean; // genuinely done (idle/archived or runState ready/archived)
  settled: boolean; // stopped on a settle condition (done OR blocked) vs timed out
  timedOut: boolean; // poll budget exhausted
  lastStatus: ThreadStatus;
  lastRunState: ThreadRunState;
  elapsedMs: number;
  attempts: number;
}

const WaitResultSchema = z.object({
  id: z.string(),
  status: z.enum(THREAD_STATUSES),
  runState: z.enum(THREAD_RUN_STATES),
  waitingOn: z.array(z.string()),
  blockedOn: z.array(z.string()),
  terminal: z.boolean(),
  settled: z.boolean(),
  timedOut: z.boolean(),
  lastStatus: z.enum(THREAD_STATUSES),
  lastRunState: z.enum(THREAD_RUN_STATES),
  elapsedMs: z.number().int(),
  attempts: z.number().int(),
});

export interface PollOptions {
  id: string;
  kind?: "thread"; // task polling is M3
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_INTERVAL_MS = 4_000;
const DEFAULT_TIMEOUT_MS = 900_000;

/**
 * Poll a thread until it settles (done/blocked), the timeout budget is exhausted, or a
 * PERMANENT CapyError aborts it fast. Yields a PollTick per poll; the AsyncGenerator's
 * return value is the final WaitResult. No retry/iterate/quality policy — pure observation.
 */
export async function* pollUntilTerminal(
  ctx: CapyContext,
  opts: PollOptions,
): AsyncGenerator<PollTick, WaitResult, void> {
  if (opts.kind && opts.kind !== "thread") {
    throw new CapyError({ code: "validation_error", message: "wait currently supports thread ids only." });
  }
  // Defensive finite guards so a NaN (e.g. a malformed CLI flag) can't disable the budget.
  const intervalMs = Number.isFinite(opts.intervalMs) ? (opts.intervalMs as number) : DEFAULT_INTERVAL_MS;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? (opts.timeoutMs as number) : DEFAULT_TIMEOUT_MS;
  const start = Date.now();
  let attempt = 0;
  let lastThread: ThreadListItem | undefined;
  let lastError: unknown;

  for (;;) {
    attempt++;
    let t: ThreadListItem | undefined;
    try {
      t = await resources(ctx).threads.get(opts.id, opts.signal);
      lastThread = t;
      lastError = undefined;
    } catch (e) {
      // Abort fast on a PERMANENT error; ride out transient ones (timeout, 5xx, rate-limit,
      // network) until the timeout budget. Pure observation — no retry/iterate policy.
      if (isPermanent(e)) throw e;
      lastError = e;
    }
    const elapsedMs = Date.now() - start;

    if (t) {
      const base = {
        id: opts.id,
        status: t.status,
        runState: t.runState,
        waitingOn: t.waitingOn,
        blockedOn: t.blockedOn,
      };
      yield { ...base, elapsedMs, attempt };
      if (isThreadSettled(t)) {
        return {
          ...base,
          terminal: isThreadDone(t),
          settled: true,
          timedOut: false,
          lastStatus: t.status,
          lastRunState: t.runState,
          elapsedMs,
          attempts: attempt,
        };
      }
    }

    if (elapsedMs >= timeoutMs) {
      if (lastThread) {
        return {
          id: opts.id,
          status: lastThread.status,
          runState: lastThread.runState,
          waitingOn: lastThread.waitingOn,
          blockedOn: lastThread.blockedOn,
          terminal: false,
          settled: false,
          timedOut: true,
          lastStatus: lastThread.status,
          lastRunState: lastThread.runState,
          elapsedMs,
          attempts: attempt,
        };
      }
      // Never observed the thread before the budget ran out — surface the transient error.
      if (lastError instanceof Error) throw lastError;
      throw new CapyError({ code: "timeout", message: "wait: no successful poll before the timeout budget." });
    }
    await sleep(Math.min(intervalMs, Math.max(0, timeoutMs - elapsedMs)), opts.signal);
  }
}

/** Drain pollUntilTerminal to its final WaitResult (the `ops.wait` convenience). */
export async function waitForThread(ctx: CapyContext, opts: PollOptions): Promise<WaitResult> {
  const gen = pollUntilTerminal(ctx, opts);
  let next = await gen.next();
  while (!next.done) next = await gen.next();
  return next.value;
}

export const wait = defineOp({
  name: "wait",
  summary: "Poll a thread until it settles (done, blocked, or timeout).",
  description:
    "Pure poll until the thread reaches a terminal state (idle/archived or runState ready/archived), " +
    "a blocked state, or the timeout budget. Aborts fast on permanent errors. terminal=false means " +
    "it stopped blocked or timed out — no retry/iterate policy.",
  effect: "read",
  input: z.object({
    id: z.string().min(1),
    timeoutSec: z.coerce.number().int().positive().optional(),
    intervalSec: z.coerce.number().int().positive().optional(),
  }),
  output: WaitResultSchema,
  async run(args, ctx) {
    return waitForThread(ctx, {
      id: args.id,
      timeoutMs: args.timeoutSec !== undefined ? args.timeoutSec * 1000 : undefined,
      intervalMs: args.intervalSec !== undefined ? args.intervalSec * 1000 : undefined,
    });
  },
});
