import { z } from "zod";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";

const page = z.object({ items: z.array(z.unknown()), cursor: z.string().nullable() });
const listStatus = z.enum(["active", "waiting", "pending_user", "error", "ready_for_review", "idle"]);
const model = z.object({
  modelId: z.string().min(1),
  reasoningMode: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).optional(),
  modes: z.object({ fast: z.boolean().optional(), pro: z.boolean().optional() }).optional(),
}).optional();

export const threadsList = defineOp({
  name: "threads.list", summary: "List project threads.", effect: "read",
  input: z.object({ status: listStatus.optional(), limit: z.coerce.number().int().min(1).max(100).optional(), cursor: z.string().optional() }),
  output: page,
  run: (a, c) => resources(c).threads.list({ ...a, projectId: requireProject(undefined, c) }),
});

export const threadsGet = defineOp({ name: "threads.get", summary: "Get a thread.", effect: "read", input: z.object({ id: z.string().min(1) }), output: z.unknown(), run: (a, c) => resources(c).threads.get(a.id) });
export const threadsRename = defineOp({ name: "threads.rename", summary: "Set or clear a thread title.", effect: "mutate", input: z.object({ id: z.string().min(1), title: z.string().nullable() }), output: z.unknown(), run: (a, c) => resources(c).threads.rename(a.id, { title: a.title }) });

const control = (name: string, summary: string, method: "interrupt" | "archive" | "unarchive" | "regenerateTitle") => defineOp({ name, summary, effect: "mutate" as const, input: z.object({ id: z.string().min(1) }), output: z.unknown(), run: (a, c) => resources(c).threads[method](a.id) });
export const threadsInterrupt = control("threads.interrupt", "Interrupt active thread work.", "interrupt");
export const threadsArchive = control("threads.archive", "Archive a thread without interrupting it.", "archive");
export const threadsUnarchive = control("threads.unarchive", "Unarchive a thread.", "unarchive");
export const threadsRegenerateTitle = control("threads.regenerate-title", "Regenerate a thread title.", "regenerateTitle");

export const threadsMessage = defineOp({ name: "threads.message", summary: "Send a message to a thread.", effect: "create", input: z.object({ id: z.string().min(1), text: z.string().min(1), delivery: z.enum(["interrupt", "queue", "steer"]).optional(), model }), output: z.object({ id: z.string(), deduped: z.boolean() }), run: (a, c) => resources(c).threads.message(a.id, { text: a.text, delivery: a.delivery, model: a.model }) });
export const threadsMessages = defineOp({ name: "threads.messages", summary: "Read a thread transcript.", effect: "read", input: z.object({ id: z.string().min(1), after: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }), output: page, run: (a, c) => resources(c).threads.messages(a.id, { after: a.after, limit: a.limit }) });
export const threadsCancelMessage = defineOp({ name: "threads.cancel-message", summary: "Cancel a queued thread message.", effect: "mutate", input: z.object({ id: z.string().min(1), eventId: z.string().min(1) }), output: z.object({ outcome: z.enum(["cancelled", "tooLate"]) }), run: (a, c) => resources(c).threads.cancelMessage(a.id, a.eventId) });
export const threadsSendMessageNow = defineOp({ name: "threads.send-message-now", summary: "Send a queued thread message immediately.", effect: "mutate", input: z.object({ id: z.string().min(1), eventId: z.string().min(1) }), output: z.object({ outcome: z.enum(["sent", "tooLate"]), id: z.string().optional() }), run: (a, c) => resources(c).threads.sendMessageNow(a.id, a.eventId) });
export const threadsTasks = defineOp({ name: "threads.tasks", summary: "List a thread's task tree.", effect: "read", input: z.object({ id: z.string().min(1), after: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }), output: page, run: (a, c) => resources(c).threads.tasks(a.id, { after: a.after, limit: a.limit }) });
export const tasksGet = defineOp({ name: "tasks.get", summary: "Get a task.", effect: "read", input: z.object({ id: z.string().min(1) }), output: z.unknown(), run: (a, c) => resources(c).tasks.get(a.id) });
export const tasksMessages = defineOp({ name: "tasks.messages", summary: "Read a task transcript.", effect: "read", input: z.object({ id: z.string().min(1), after: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }), output: page, run: (a, c) => resources(c).tasks.messages(a.id, { after: a.after, limit: a.limit }) });
