import type { Thread } from "./client/resources.js";

export const THREAD_STATUSES = ["active", "waiting", "pending_user", "error", "ready_for_review", "idle", "archived"] as const;
export type ThreadStatus = Thread["status"];
export const SETTLED_THREAD_STATUSES = new Set<ThreadStatus>(["pending_user", "error", "ready_for_review", "idle", "archived"]);
export const isThreadSettled = (x: { status: ThreadStatus }) => SETTLED_THREAD_STATUSES.has(x.status);
export const isThreadDone = (x: { status: ThreadStatus }) => x.status === "ready_for_review" || x.status === "idle";
