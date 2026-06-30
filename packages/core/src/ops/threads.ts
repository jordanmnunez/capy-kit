import { z } from "zod";

import type { CapyContext } from "../client/context.js";
import {
  resources,
  type ListMessagesQuery,
  type ListThreadsQuery,
  type SendThreadMessageBody,
  type ThreadListItem,
  type ThreadMessage,
} from "../client/resources.js";
import {
  ListMessagesResponseSchema,
  ListThreadsResponseSchema,
  SendMessageResponseSchema,
  ThreadListItemSchema,
} from "../client/schemas.js";
import { ORIGINS, PR_STATES, THREAD_STATUSES, resolveModelAlias } from "../model.js";
import { csvArray, defineOp } from "./define.js";
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

export const threadsMessage = defineOp({
  name: "threads.message",
  summary: "Send a message to a live thread to steer Captain (keeps its accumulated context).",
  description:
    "POST a message to an existing thread — the faithful way to RE-STEER without spawning a new " +
    "thread (which loses Captain's context). `model` takes an alias (opus/sonnet/haiku) or a full id; " +
    "omit it to continue with the thread's current model. capy-kit does not gate or judge the reply.",
  effect: "create",
  input: z.object({
    id: z.string().min(1),
    message: z.string().min(1),
    model: z.string().optional(),
    attachmentUrls: csvArray(z.string()).optional(),
    impersonateUserEmail: z.string().optional(),
  }),
  output: SendMessageResponseSchema,
  async run(args, ctx) {
    const body: SendThreadMessageBody = { message: args.message };
    const model = resolveModelAlias(args.model);
    if (model) body.model = model as SendThreadMessageBody["model"];
    if (args.attachmentUrls && args.attachmentUrls.length > 0) body.attachmentUrls = args.attachmentUrls;
    if (args.impersonateUserEmail) body.impersonateUserEmail = args.impersonateUserEmail;
    return resources(ctx).threads.message(args.id, body);
  },
});

export const threadsMessages = defineOp({
  name: "threads.messages",
  summary: "Read a thread's messages, oldest→newest (the conversation log).",
  description:
    "List the messages on a thread. The API is newest-first; this op returns them oldest→newest " +
    "within the set (so the newest message is last and the log reads top-to-bottom). `nextCursor` " +
    "pages to OLDER messages; --all collects every page and returns the full log chronologically.",
  effect: "read",
  input: z.object({
    id: z.string().min(1),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    all: z.boolean().optional(),
  }),
  output: ListMessagesResponseSchema,
  async run(args, ctx) {
    if (args.all) {
      const collected: ThreadMessage[] = [];
      for await (const m of resources(ctx).threads.listAllMessages(args.id)) collected.push(m);
      collected.reverse(); // API yields newest-first across pages -> oldest-first
      return { items: collected, nextCursor: null, hasMore: false };
    }
    const query: ListMessagesQuery = {};
    if (args.cursor !== undefined) query.cursor = args.cursor;
    if (args.limit !== undefined) query.limit = args.limit;
    const page = await resources(ctx).threads.listMessages(args.id, query);
    return { ...page, items: [...page.items].reverse() };
  },
});
