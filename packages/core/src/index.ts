// @capy-kit/core — the single source of truth. A faithful, typed interface to the Capy
// API plus thin conveniences (delegate, wait, listAll). Returns data, never prints.

export {
  resolveContext,
  DEFAULTS,
  type CapyContext,
  type CapyContextInput,
} from "./client/context.js";

export {
  CapyError,
  type CapyErrorCode,
  type CapyErrorInit,
  PERMANENT_CODES,
  isCapyError,
  isPermanent,
  statusToCode,
  exitCodeFor,
} from "./client/errors.js";

export { request, backoffMs, type RequestOptions, type HttpMethod } from "./client/transport.js";

export {
  resources,
  type Resources,
  type CreateThreadBody,
  type CreateThreadResponse,
  type ThreadListItem,
  type ListThreadsResponse,
  type ListThreadsQuery,
  type Project,
  type ListProjectsResponse,
  type ProjectListItem,
  type ListProjectsQuery,
} from "./client/resources.js";

export * from "./model.js";

export {
  OPS,
  ops,
  opsByName,
  delegate,
  threadsList,
  threadsGet,
  wait,
  status,
  projectsList,
  projectsGet,
  listAllThreads,
  pollUntilTerminal,
  waitForThread,
  type PollTick,
  type WaitResult,
  type PollOptions,
} from "./ops/index.js";

export { defineOp, csvArray, type Op, type OpSpec, type TypedOp, type Effect } from "./ops/define.js";

export { render, type OutputFormat } from "./render/index.js";

export {
  ThreadListItemSchema,
  ListThreadsResponseSchema,
  CreateThreadResponseSchema,
  ProjectSchema,
  ListProjectsResponseSchema,
} from "./client/schemas.js";
