// Enums, terminal-state sets, model aliases, and URL helpers — all derived from the
// vendored spec's REAL vocabulary (see AGENTS.md "Resolved API facts"). No invented
// states, no hardcoded "failed", no hardcoded model id in business logic.

export const THREAD_STATUSES = ["active", "idle", "archived"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const THREAD_RUN_STATES = ["running", "queued", "waiting", "blocked", "ready", "archived"] as const;
export type ThreadRunState = (typeof THREAD_RUN_STATES)[number];

export const WAITING_ON = ["task", "review", "ci", "timer", "worker"] as const;
export type WaitingOn = (typeof WAITING_ON)[number];

export const BLOCKED_ON = ["auth", "permission"] as const;
export type BlockedOn = (typeof BLOCKED_ON)[number];

export const TASK_STATUSES = [
  "backlog",
  "queued",
  "in_progress",
  "needs_review",
  "completed",
  "error",
  "archived",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ORIGINS = ["web", "slack", "api", "linear", "automation"] as const;
export type Origin = (typeof ORIGINS)[number];

export const PR_STATES = ["open", "merged", "closed", "none"] as const;
export type PrState = (typeof PR_STATES)[number];

export const TAG_COLORS = [
  "default",
  "primary",
  "success",
  "warning",
  "destructive",
  "blue",
  "purple",
  "pink",
  "orange",
  "lime",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

// Terminal status sets (coarse signal). It is `error`, not `failed`.
export const TERMINAL_THREAD_STATUS: ReadonlySet<ThreadStatus> = new Set<ThreadStatus>(["idle", "archived"]);
export const TERMINAL_TASK_STATUS: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "completed",
  "error",
  "archived",
]);

// runState is the finer "will this move on its own?" signal used by `wait`:
//   running/queued/waiting -> still progressing (waitingOn = async deps that continue)
//   ready/archived         -> genuinely done
//   blocked                -> needs a human/integration gate (blockedOn); won't self-progress
export const DONE_THREAD_RUN_STATE: ReadonlySet<ThreadRunState> = new Set<ThreadRunState>([
  "ready",
  "archived",
]);
export const STOP_THREAD_RUN_STATE: ReadonlySet<ThreadRunState> = new Set<ThreadRunState>([
  "ready",
  "archived",
  "blocked",
]);

export interface ThreadStateLike {
  status: ThreadStatus;
  runState: ThreadRunState;
}

/** Stop polling: the thread reached a state it won't leave without external action. */
export function isThreadSettled(t: ThreadStateLike): boolean {
  return TERMINAL_THREAD_STATUS.has(t.status) || STOP_THREAD_RUN_STATE.has(t.runState);
}

/** Genuinely finished (not merely blocked/timed-out). Drives `wait`'s `terminal` flag. */
export function isThreadDone(t: ThreadStateLike): boolean {
  return TERMINAL_THREAD_STATUS.has(t.status) || DONE_THREAD_RUN_STATE.has(t.runState);
}

export function isTaskTerminal(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUS.has(status);
}

// Friendly CLI aliases. The default model + full alias map come from /v1/models at
// runtime (M3); these three are stable conveniences and the default is configurable.
export const DEFAULT_MODEL = "claude-opus-4-8";
export const MODEL_ALIASES: Readonly<Record<string, string>> = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
};

export function resolveModelAlias(model: string | undefined): string | undefined {
  if (!model) return undefined;
  return MODEL_ALIASES[model] ?? model;
}

// NOTE: confirmed against the live API — thread ids AND task ids are opaque UUIDs
// (the spec's `jam_123` example is stale), so no prefix heuristic can tell them apart.
// `wait`/`pollUntilTerminal` therefore take an explicit `kind` (default "thread") rather
// than guessing from the id shape. No isThreadId() heuristic is provided.

/**
 * Web-IDE URL for a thread. The `/project/{projectId}/captain/{threadId}` scheme is
 * CONFIRMED against the live product (2026-06-26). Host is configurable via
 * CAPY_WEB_URL / ctx.webBaseUrl.
 */
export function threadUrl(webBaseUrl: string, projectId: string, threadId: string): string {
  const base = webBaseUrl.replace(/\/+$/, "");
  return `${base}/project/${projectId}/captain/${threadId}`;
}
