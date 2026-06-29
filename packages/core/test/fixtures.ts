import type {
  CreateThreadResponse,
  ListThreadsResponse,
  ThreadListItem,
} from "../src/index.js";

// Faithful recorded wire shapes (every required field present, real enum values).

export function makeThread(over: Partial<ThreadListItem> = {}): ThreadListItem {
  return {
    id: "jam_abc123",
    projectId: "proj_test",
    title: "Fix the flaky migration test",
    status: "active",
    runState: "running",
    waitingOn: [],
    blockedOn: [],
    pendingWakeups: 0,
    tasks: [
      { id: "tsk_1", threadIndex: 0, identifier: "CAP-12", title: "Investigate failure", status: "in_progress" },
    ],
    participants: [
      {
        userId: "usr_1",
        userType: "human",
        firstParticipatedAt: "2026-06-26T10:00:00.000Z",
        lastParticipatedAt: "2026-06-26T10:05:00.000Z",
      },
    ],
    pullRequests: [
      {
        number: 42,
        url: "https://github.com/owner/repo/pull/42",
        repoFullName: "owner/repo",
        state: "open",
        headRef: "capy/fix-flaky",
        baseRef: "main",
        draft: false,
      },
    ],
    slackThreads: [],
    tags: [{ name: "eng-123", color: "blue" }],
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:05:00.000Z",
    ...over,
  };
}

export function makePage(over: Partial<ListThreadsResponse> = {}): ListThreadsResponse {
  return {
    items: [makeThread()],
    nextCursor: null,
    hasMore: false,
    ...over,
  };
}

export function makeCreateResponse(over: Partial<CreateThreadResponse> = {}): CreateThreadResponse {
  return {
    id: "jam_new001",
    projectId: "proj_test",
    title: null,
    status: "active",
    runState: "running",
    waitingOn: [],
    blockedOn: [],
    pendingWakeups: 0,
    participants: [],
    tags: [],
    createdAt: "2026-06-26T11:00:00.000Z",
    ...over,
  };
}
