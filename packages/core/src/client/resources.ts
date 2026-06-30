import type { CapyContext } from "./context.js";
import type { components, operations } from "./schema.js";
import { request } from "./transport.js";

type Schemas = components["schemas"];

export type CreateThreadBody = Schemas["CreateThreadBody"];
export type CreateThreadResponse = Schemas["CreateThreadResponse"];
export type ThreadListItem = Schemas["ThreadListItem"];
export type ListThreadsResponse = Schemas["ListThreadsResponse"];
export type ListThreadsQuery = NonNullable<operations["listThreads"]["parameters"]["query"]>;

export type Project = Schemas["Project"];
export type ListProjectsResponse = Schemas["ListProjectsResponse"];
export type ProjectListItem = ListProjectsResponse["items"][number];
export type ListProjectsQuery = NonNullable<operations["listProjects"]["parameters"]["query"]>;

export type SendThreadMessageBody = Schemas["SendThreadMessageBody"];
export type SendMessageResponse = Schemas["SendMessageResponse"];
export type ListMessagesResponse = Schemas["ListMessagesResponse"];
export type ThreadMessage = ListMessagesResponse["items"][number];
export type ListMessagesQuery = NonNullable<operations["listThreadMessages"]["parameters"]["query"]>;

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Typed, faithful 1:1 wrappers over the API endpoints. Every method goes through
 * `request`, so it inherits auth/retry/timeout/error behavior. More resources
 * (tasks, usage, models, env) are added in their milestones.
 */
export function resources(ctx: CapyContext) {
  return {
    threads: {
      create: (body: CreateThreadBody, signal?: AbortSignal): Promise<CreateThreadResponse> =>
        request<CreateThreadResponse>(ctx, { method: "POST", path: "/v1/threads", body, signal }),

      get: (threadId: string, signal?: AbortSignal): Promise<ThreadListItem> =>
        request<ThreadListItem>(ctx, {
          method: "GET",
          path: `/v1/threads/${encodeId(threadId)}`,
          signal,
        }),

      /** Send a message to a live thread (steer Captain without spawning a new thread). */
      message: (threadId: string, body: SendThreadMessageBody, signal?: AbortSignal): Promise<SendMessageResponse> =>
        request<SendMessageResponse>(ctx, {
          method: "POST",
          path: `/v1/threads/${encodeId(threadId)}/message`,
          body,
          signal,
        }),

      /** One page of a thread's messages (API order: newest-first). */
      listMessages: (
        threadId: string,
        query: ListMessagesQuery = {},
        signal?: AbortSignal,
      ): Promise<ListMessagesResponse> =>
        request<ListMessagesResponse>(ctx, {
          method: "GET",
          path: `/v1/threads/${encodeId(threadId)}/messages`,
          query: query as Record<string, string | number | boolean | undefined>,
          signal,
        }),

      /** Auto-follow nextCursor across every page (yields in API order: newest-first). */
      listAllMessages: async function* (
        threadId: string,
        query: Omit<ListMessagesQuery, "cursor"> = {},
        signal?: AbortSignal,
      ): AsyncGenerator<ThreadMessage, void, void> {
        let cursor: string | undefined;
        for (;;) {
          const page: ListMessagesResponse = await request<ListMessagesResponse>(ctx, {
            method: "GET",
            path: `/v1/threads/${encodeId(threadId)}/messages`,
            query: { ...query, cursor } as Record<string, string | number | boolean | undefined>,
            signal,
          });
          for (const item of page.items) yield item;
          if (!page.hasMore || !page.nextCursor) return;
          cursor = page.nextCursor;
        }
      },

      list: (query: ListThreadsQuery, signal?: AbortSignal): Promise<ListThreadsResponse> =>
        request<ListThreadsResponse>(ctx, {
          method: "GET",
          path: "/v1/threads",
          query: query as Record<string, string | number | boolean | undefined>,
          signal,
        }),

      /** Auto-follow nextCursor across every page. Don't stop at page 1. */
      listAll: async function* (
        query: Omit<ListThreadsQuery, "cursor">,
        signal?: AbortSignal,
      ): AsyncGenerator<ThreadListItem, void, void> {
        let cursor: string | undefined;
        for (;;) {
          const page: ListThreadsResponse = await request<ListThreadsResponse>(ctx, {
            method: "GET",
            path: "/v1/threads",
            query: { ...query, cursor } as Record<string, string | number | boolean | undefined>,
            signal,
          });
          for (const item of page.items) yield item;
          if (!page.hasMore || !page.nextCursor) return;
          cursor = page.nextCursor;
        }
      },
    },

    projects: {
      /** List projects the API key can see. Needs no project context — this is how you discover ids. */
      list: (query: ListProjectsQuery = {}, signal?: AbortSignal): Promise<ListProjectsResponse> =>
        request<ListProjectsResponse>(ctx, {
          method: "GET",
          path: "/v1/projects",
          query: query as Record<string, string | number | boolean | undefined>,
          signal,
        }),

      /** Auto-follow nextCursor across every page. */
      listAll: async function* (
        query: Omit<ListProjectsQuery, "cursor"> = {},
        signal?: AbortSignal,
      ): AsyncGenerator<ProjectListItem, void, void> {
        let cursor: string | undefined;
        for (;;) {
          const page: ListProjectsResponse = await request<ListProjectsResponse>(ctx, {
            method: "GET",
            path: "/v1/projects",
            query: { ...query, cursor } as Record<string, string | number | boolean | undefined>,
            signal,
          });
          for (const item of page.items) yield item;
          if (!page.hasMore || !page.nextCursor) return;
          cursor = page.nextCursor;
        }
      },

      get: (projectId: string, signal?: AbortSignal): Promise<Project> =>
        request<Project>(ctx, {
          method: "GET",
          path: `/v1/projects/${encodeId(projectId)}`,
          signal,
        }),
    },
  };
}

export type Resources = ReturnType<typeof resources>;
