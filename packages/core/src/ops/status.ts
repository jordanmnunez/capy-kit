import { z } from "zod";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES, threadUrl } from "../model.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";

export const status = defineOp({
  name: "status", summary: "List project threads and their current status.", effect: "read",
  input: z.object({ projectId: z.string().optional(), status: z.enum(THREAD_STATUSES).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
  output: z.unknown(),
  async run(a, c) {
    const projectId = requireProject(a.projectId, c);
    const p = await resources(c).threads.list({ projectId, status: a.status, limit: a.limit ?? 50 });
    return { projectId, count: p.items.length, threads: p.items.map((t) => ({ ...t, url: threadUrl(c.webBaseUrl, t.projectId, t.id) })) };
  },
});
