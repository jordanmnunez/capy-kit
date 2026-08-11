import { z } from "zod";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";
export const delegate = defineOp({ name: "delegate", summary: "Create and start a Capy thread.", effect: "create", input: z.object({ message: z.string().min(1), requestId: z.string().min(1).max(191), title: z.string().optional() }), output: z.object({ threadId: z.string(), projectId: z.string(), title: z.string().nullable(), status: z.enum(THREAD_STATUSES), createdAt: z.string() }), async run(a, c) { const projectId = requireProject(undefined, c); const t = await resources(c).threads.create({ ...a, projectId }); return { threadId: t.id, projectId: t.projectId, title: t.title, status: t.status, createdAt: t.createdAt }; } });
