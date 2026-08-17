import { z } from "zod";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";
const model = z.object({ modelId: z.string().min(1), reasoningMode: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).optional(), modes: z.object({ fast: z.boolean().optional(), pro: z.boolean().optional() }).optional() }).optional();
export const delegate = defineOp({ name: "delegate", summary: "Create and start a Capy thread.", effect: "create", input: z.object({ message: z.string().min(1), requestId: z.string().min(1).max(191), title: z.string().optional(), model, machineSize: z.enum(["small", "medium", "large", "ultra", "hyper", "bigguy"]).optional() }), output: z.object({ threadId: z.string(), projectId: z.string().nullable(), title: z.string().nullable(), status: z.enum(THREAD_STATUSES), createdAt: z.string() }), async run(a, c) { const projectId = requireProject(undefined, c); const t = await resources(c).threads.create({ ...a, projectId }); return { threadId: t.id, projectId: t.projectId, title: t.title, status: t.status, createdAt: t.createdAt }; } });
