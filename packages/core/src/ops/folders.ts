import { z } from "zod";
import { resources } from "../client/resources.js";
import { csvArray, defineOp } from "./define.js";

const id = z.string().min(1);
const threadIds = csvArray(id).pipe(z.array(id).min(1));
const page = z.object({ items: z.array(z.unknown()), cursor: z.string().nullable() });
const outcomes = z.object({ outcomes: z.array(z.object({ threadId: id, outcome: z.enum(["ok", "not_found", "not_allowed"]) })) });
const folder = z.object({ id, name: z.string().nullable(), kind: z.enum(["pinned", "custom"]), visibility: z.enum(["private", "shared"]), createdAt: z.string(), updatedAt: z.string() });

export const foldersList = defineOp({ name: "folders.list", summary: "List organization folders.", effect: "read", input: z.object({}), output: z.object({ items: z.array(folder) }), run: (_a, c) => resources(c).folders.list() });
export const foldersThreads = defineOp({ name: "folders.threads", summary: "List threads in a folder.", effect: "read", input: z.object({ folderId: id, after: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }), output: page, run: (a, c) => resources(c).folders.threads(a.folderId, { after: a.after, limit: a.limit }) });
export const foldersFile = defineOp({ name: "folders.file", summary: "Add threads to a folder.", effect: "mutate", input: z.object({ folderId: id, threadIds }), output: outcomes, run: (a, c) => resources(c).folders.file(a.folderId, { threadIds: a.threadIds }) });
export const foldersUnfile = defineOp({ name: "folders.unfile", summary: "Remove threads from a folder.", effect: "mutate", input: z.object({ folderId: id, threadIds }), output: outcomes, run: (a, c) => resources(c).folders.unfile(a.folderId, { threadIds: a.threadIds }) });
const pin = (name: "folders.pin" | "folders.unpin", summary: string, method: "pin" | "unpin") => defineOp({ name, summary, effect: "mutate" as const, input: z.object({ threadIds, userId: id.optional() }), output: outcomes, run: (a, c) => resources(c).folders[method]({ threadIds: a.threadIds, userId: a.userId }) });
export const foldersPin = pin("folders.pin", "Pin threads for an organization user.", "pin");
export const foldersUnpin = pin("folders.unpin", "Unpin threads for an organization user.", "unpin");
