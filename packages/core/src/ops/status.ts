import { z } from "zod";

import { resources, type ListThreadsQuery, type ThreadListItem } from "../client/resources.js";
import { THREAD_RUN_STATES, THREAD_STATUSES, threadUrl } from "../model.js";
import type { CapyContext } from "../client/context.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";

const StatusRow = z.object({
  id: z.string(),
  title: z.string().nullable(),
  status: z.enum(THREAD_STATUSES),
  runState: z.enum(THREAD_RUN_STATES),
  waitingOn: z.array(z.string()),
  blockedOn: z.array(z.string()),
  pendingWakeups: z.number().int(),
  tasks: z.array(z.object({ identifier: z.string(), status: z.string() })),
  pr: z
    .object({ number: z.number().int(), state: z.string(), url: z.string() })
    .nullable(),
  url: z.string(),
  updatedAt: z.string(),
});

const StatusOutput = z.object({
  projectId: z.string(),
  count: z.number().int(),
  threads: z.array(StatusRow),
});

function toRow(ctx: CapyContext, t: ThreadListItem): z.infer<typeof StatusRow> {
  const pr = t.pullRequests[0];
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    runState: t.runState,
    waitingOn: t.waitingOn,
    blockedOn: t.blockedOn,
    pendingWakeups: t.pendingWakeups,
    tasks: t.tasks.map((task) => ({ identifier: task.identifier, status: task.status })),
    pr: pr ? { number: pr.number, state: pr.state, url: pr.url } : null,
    url: threadUrl(ctx.webBaseUrl, t.projectId, t.id),
    updatedAt: t.updatedAt,
  };
}

export const status = defineOp({
  name: "status",
  summary: "Plain dashboard of your threads with real status/runState (no buckets, no recs).",
  description:
    "Faithful list of in-flight work: each thread's real status, runState, waitingOn, blockedOn, " +
    "tasks, and PR. Defaults to active threads. No triage buckets or recommendations — you (or Capy) decide.",
  effect: "read",
  input: z.object({
    projectId: z.string().optional(),
    status: z.enum(THREAD_STATUSES).optional(),
    authorEmail: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    all: z.boolean().optional(),
  }),
  output: StatusOutput,
  async run(args, ctx) {
    const projectId = requireProject(args.projectId, ctx);
    const filters: ListThreadsQuery = {
      projectId,
      status: args.status ?? "active",
      ...(args.authorEmail !== undefined ? { authorEmail: args.authorEmail } : {}),
    };
    let items: ThreadListItem[];
    if (args.all) {
      items = [];
      for await (const item of resources(ctx).threads.listAll(filters)) items.push(item);
    } else {
      const page = await resources(ctx).threads.list({ ...filters, limit: args.limit ?? 50 });
      items = page.items;
    }
    return { projectId, count: items.length, threads: items.map((t) => toRow(ctx, t)) };
  },
});
