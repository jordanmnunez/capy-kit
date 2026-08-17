import { z } from "zod";
import { resources } from "../client/resources.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";
export const status = defineOp({ name: "status", summary: "List project threads and current statuses.", effect: "read", input: z.object({ status: z.enum(["active", "waiting", "pending_user", "error", "ready_for_review", "idle"]).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }), output: z.unknown(), async run(a, c) { const projectId = requireProject(undefined, c); const p = await resources(c).threads.list({ ...a, projectId }); return { projectId, count: p.items.length, threads: p.items }; } });
