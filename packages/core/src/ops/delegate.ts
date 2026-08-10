import { z } from "zod";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
export const delegate = defineOp({ name: "delegate", summary: "Create and start a Capy thread.", effect: "create", input: z.object({ message: z.string().min(1), requestId: z.string().min(1).max(191), title: z.string().optional() }), output: z.object({ threadId: z.string(), title: z.string().nullable(), status: z.enum(THREAD_STATUSES), createdAt: z.string() }), async run(a, c) { const t = await resources(c).threads.create(a); return { threadId: t.id, title: t.title, status: t.status, createdAt: t.createdAt }; } });
