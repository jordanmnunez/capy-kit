import { z } from "zod";

import type { CapyContext } from "../client/context.js";
import { resources, type ListThreadsQuery, type ThreadListItem } from "../client/resources.js";
import { ListThreadsResponseSchema, ThreadListItemSchema } from "../client/schemas.js";
import { ORIGINS, PR_STATES, THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";

// Full faithful filter set from ListThreadsQuery.
const ListInput = z.object({
  projectId: z.string().optional(),
  status: z.enum(THREAD_STATUSES).optional(),
  branch: z.string().optional(),
  // Empty string / null -> undefined (omitted) rather than coercing to a bogus prNumber=0.
  // The spec allows any integer, so we don't over-constrain with .positive().
  prNumber: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().optional()),
  prState: z.enum(PR_STATES).optional(),
  authorId: z.string().optional(),
  authorEmail: z.string().optional(),
  participantId: z.string().optional(),
  participantEmail: z.string().optional(),
  origin: z.enum(ORIGINS).optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  slackThreadTs: z.string().optional(),
  slackChannelId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  all: z.boolean().optional(),
});

function buildQuery(args: z.infer<typeof ListInput>, projectId: string): ListThreadsQuery {
  // Drop undefined + the CLI-only `all` flag so we never send empty query params.
  const q: Record<string, unknown> = { projectId };
  for (const [key, value] of Object.entries(args)) {
    if (key === "all" || key === "projectId" || value === undefined) continue;
    q[key] = value;
  }
  return q as ListThreadsQuery;
}

/** Stream every matching thread across all pages (the `client.threads.listAll` convenience). */
export async function* listAllThreads(
  ctx: CapyContext,
  filters: Omit<ListThreadsQuery, "cursor">,
  signal?: AbortSignal,
): AsyncGenerator<ThreadListItem, void, void> {
  yield* resources(ctx).threads.listAll(filters, signal);
}

export const threadsList = defineOp({
  name: "threads.list",
  summary: "List threads for a project with the full filter set.",
  description:
    "List captain threads. Supports status/branch/pr/author/participant/origin/tag/q filters, " +
    "cursor pagination, and --all to auto-follow every page.",
  effect: "read",
  input: ListInput,
  output: ListThreadsResponseSchema,
  async run(args, ctx) {
    const projectId = requireProject(args.projectId, ctx);
    const query = buildQuery(args, projectId);
    if (args.all) {
      const { cursor: _omitCursor, ...filters } = query;
      const items: ThreadListItem[] = [];
      for await (const item of resources(ctx).threads.listAll(filters)) items.push(item);
      return { items, nextCursor: null, hasMore: false };
    }
    return resources(ctx).threads.list(query);
  },
});

export const threadsGet = defineOp({
  name: "threads.get",
  summary: "Get a single thread by id (status, runState, tasks, PRs, tags).",
  effect: "read",
  input: z.object({ id: z.string().min(1) }),
  output: ThreadListItemSchema,
  async run(args, ctx) {
    return resources(ctx).threads.get(args.id);
  },
});
