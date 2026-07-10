// Enums, terminal-state sets, model aliases, and URL helpers — all derived from the
// vendored spec's REAL vocabulary (see AGENTS.md "Resolved API facts"). No invented
// states, no hardcoded "failed", no hardcoded model id in business logic.

export const THREAD_STATUSES = ["active", "idle", "archived"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const THREAD_RUN_STATES = [
  "running",
  "stopping",
  "queued",
  "waiting",
  "blocked",
  "ready",
  "archived",
] as const;
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

export const ORIGINS = ["web", "slack", "api", "linear", "automation", "github"] as const;
export type Origin = (typeof ORIGINS)[number];

export const MESSAGE_MODES = ["interrupt", "queue"] as const;
export type MessageMode = (typeof MESSAGE_MODES)[number];

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

// Coarse status vocabulary. Do NOT use `idle` alone to stop a poll: the live API can
// report status=idle while runState=waiting on review/CI. An archived status is the
// exception: live responses can retain a stale non-archived runState after archival.
export const SETTLED_THREAD_STATUS: ReadonlySet<ThreadStatus> = new Set<ThreadStatus>(["archived"]);
/** @deprecated A coarse status cannot prove successful completion. Use isThreadDone/isThreadSettled. */
export const TERMINAL_THREAD_STATUS: ReadonlySet<ThreadStatus> = SETTLED_THREAD_STATUS;
export const TERMINAL_TASK_STATUS: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "completed",
  "error",
  "archived",
]);

// runState is the finer "will this move on its own?" signal used by `wait`:
//   running/stopping/queued/waiting -> still progressing (waitingOn = async deps that continue)
//   ready                  -> genuinely done
//   archived               -> stopped/closed; success is not established by this state alone
//   blocked                -> needs a human/integration gate (blockedOn); won't self-progress
export const DONE_THREAD_RUN_STATE: ReadonlySet<ThreadRunState> = new Set<ThreadRunState>([
  "ready",
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

/** Stop polling: runState settled, or the coarse status proves the thread was archived. */
export function isThreadSettled(t: ThreadStateLike): boolean {
  return SETTLED_THREAD_STATUS.has(t.status) || STOP_THREAD_RUN_STATE.has(t.runState);
}

/** Genuinely finished (not merely blocked/timed-out). Drives `wait`'s `terminal` flag. */
export function isThreadDone(t: ThreadStateLike): boolean {
  return t.status !== "archived" && DONE_THREAD_RUN_STATE.has(t.runState);
}

export function isTaskTerminal(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUS.has(status);
}

// Friendly local CLI aliases. /v1/models supplies availability and Captain eligibility,
// not aliases or a default; these conveniences and the configurable fallback are ours.
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

// Reasoning effort for `reasoning.mode` on create-thread / send-message (the spec's enum,
// shared by CreateThreadBody and SendThreadMessageBody). Which modes a given model accepts
// is model-dependent — pass through faithfully; the API validates.
export const REASONING_MODES = [
  "off",
  "on",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type ReasoningMode = (typeof REASONING_MODES)[number];

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
  return `${base}/project/${encodeURIComponent(projectId)}/captain/${encodeURIComponent(threadId)}`;
}
