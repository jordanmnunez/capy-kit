import { z } from "zod";

import { resources, type ListProjectsQuery, type ProjectListItem } from "../client/resources.js";
import { ListProjectsResponseSchema, ProjectSchema } from "../client/schemas.js";
import { defineOp } from "./define.js";

const ListInput = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  all: z.boolean().optional(),
});

export const projectsList = defineOp({
  name: "projects.list",
  summary: "List the projects your API key can see (discover project ids).",
  description:
    "Faithful list of projects (id, name, taskCode, repos). This is how you find the project id " +
    "to pass to --project or set as CAPY_PROJECT_ID — it needs only the API key, no project context.",
  effect: "read",
  input: ListInput,
  output: ListProjectsResponseSchema,
  async run(args, ctx) {
    if (args.all) {
      const items: ProjectListItem[] = [];
      for await (const item of resources(ctx).projects.listAll()) items.push(item);
      return { items, nextCursor: null, hasMore: false };
    }
    const query: ListProjectsQuery = {};
    if (args.cursor !== undefined) query.cursor = args.cursor;
    if (args.limit !== undefined) query.limit = args.limit;
    return resources(ctx).projects.list(query);
  },
});

export const projectsGet = defineOp({
  name: "projects.get",
  summary: "Get one project by id (name, taskCode, repos).",
  effect: "read",
  input: z.object({ id: z.string().min(1) }),
  output: ProjectSchema,
  async run(args, ctx) {
    return resources(ctx).projects.get(args.id);
  },
});
