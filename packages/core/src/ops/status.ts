import { z } from "zod";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
export const status = defineOp({ name: "status", summary: "List organization threads and current statuses.", effect: "read", input: z.object({ status: z.enum(THREAD_STATUSES).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }), output: z.unknown(), async run(a, c) { const p = await resources(c).threads.list(a); return { count: p.items.length, threads: p.items }; } });
