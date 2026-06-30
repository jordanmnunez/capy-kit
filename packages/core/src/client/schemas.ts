import { z } from "zod";

import {
  BLOCKED_ON,
  TAG_COLORS,
  TASK_STATUSES,
  THREAD_RUN_STATES,
  THREAD_STATUSES,
  WAITING_ON,
} from "../model.js";
import type { components } from "./schema.js";

// Zod mirrors of the wire types we read in M1. They power the `ctx.validate` boundary
// check and the contract test (fixtures parsed through these). Drift between these and
// the GENERATED types (schema.d.ts) is caught by the `Exact<>` assertions at the bottom.

type Wire = components["schemas"];

export const ThreadStatusSchema = z.enum(THREAD_STATUSES);
export const ThreadRunStateSchema = z.enum(THREAD_RUN_STATES);
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const WaitingOnSchema = z.enum(WAITING_ON);
export const BlockedOnSchema = z.enum(BLOCKED_ON);
export const TagColorSchema = z.enum(TAG_COLORS);

export const EmbeddedTaskSchema = z
  .object({
    id: z.string(),
    threadIndex: z.number().int().nullable(),
    identifier: z.string(),
    title: z.string(),
    status: TaskStatusSchema,
  })
  .strict();

export const PullRequestSchema = z
  .object({
    number: z.number().int(),
    url: z.string(),
    repoFullName: z.string(),
    state: z.string(),
    headRef: z.string(),
    baseRef: z.string(),
    draft: z.boolean(),
  })
  .strict();

export const ParticipantSchema = z
  .object({
    userId: z.string(),
    userType: z.enum(["human", "service_user"]),
    firstParticipatedAt: z.string(),
    lastParticipatedAt: z.string(),
  })
  .strict();

export const SlackThreadSchema = z
  .object({
    teamId: z.string(),
    channelId: z.string(),
    threadTs: z.string(),
    url: z.string(),
  })
  .strict();

export const ThreadTagSchema = z
  .object({
    name: z.string(),
    color: TagColorSchema,
  })
  .strict();

export const ThreadListItemSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string().nullable(),
    status: ThreadStatusSchema,
    runState: ThreadRunStateSchema,
    waitingOn: z.array(WaitingOnSchema),
    blockedOn: z.array(BlockedOnSchema),
    pendingWakeups: z.number().int(),
    tasks: z.array(EmbeddedTaskSchema),
    participants: z.array(ParticipantSchema),
    pullRequests: z.array(PullRequestSchema),
    slackThreads: z.array(SlackThreadSchema),
    tags: z.array(ThreadTagSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const ListThreadsResponseSchema = z
  .object({
    items: z.array(ThreadListItemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .strict();

export const CreateThreadResponseSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string().nullable(),
    status: ThreadStatusSchema,
    runState: ThreadRunStateSchema,
    waitingOn: z.array(WaitingOnSchema),
    blockedOn: z.array(BlockedOnSchema),
    pendingWakeups: z.number().int(),
    participants: z.array(ParticipantSchema),
    tags: z.array(ThreadTagSchema),
    slack: SlackThreadSchema.optional(),
    createdAt: z.string(),
  })
  .strict();

export const ProjectRepoSchema = z
  .object({
    repoFullName: z.string(),
    branch: z.string(),
  })
  .strict();

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    taskCode: z.string(),
    repos: z.array(ProjectRepoSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const ListProjectsResponseSchema = z
  .object({
    items: z.array(ProjectSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .strict();

export type ThreadListItem = z.infer<typeof ThreadListItemSchema>;
export type ListThreadsResponse = z.infer<typeof ListThreadsResponseSchema>;
export type CreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;

// --- drift guards: zod mirror must equal the generated wire type, both directions ---
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _checkThreadListItem: Exact<ThreadListItem, Wire["ThreadListItem"]> = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _checkListThreads: Exact<ListThreadsResponse, Wire["ListThreadsResponse"]> = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _checkCreateThread: Exact<CreateThreadResponse, Wire["CreateThreadResponse"]> = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _checkProject: Exact<Project, Wire["Project"]> = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _checkListProjects: Exact<ListProjectsResponse, Wire["ListProjectsResponse"]> = true;
