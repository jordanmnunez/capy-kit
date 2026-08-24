import { z } from "zod";

import { resources } from "../client/resources.js";
import { defineOp } from "./define.js";

const project = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  code: z.string().min(1).max(255),
  repos: z.array(z.object({ repoFullName: z.string(), baseBranch: z.string() })),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Project inspection is organization-scoped and deliberately does not require a default project. */
export const projectsList = defineOp({
  name: "projects.list",
  summary: "List accessible projects.",
  effect: "read",
  input: z.object({}),
  output: z.object({ items: z.array(project) }),
  run: (_a, c) => resources(c).projects.list(),
});

export const projectsGet = defineOp({
  name: "projects.get",
  summary: "Get a project.",
  effect: "read",
  input: z.object({ id: z.string().min(1) }),
  output: project,
  run: (a, c) => resources(c).projects.get(a.id),
});
