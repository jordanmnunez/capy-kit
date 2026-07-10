import { z } from "zod";

import { resources } from "../client/resources.js";
import { ListModelsResponseSchema } from "../client/schemas.js";
import { defineOp } from "./define.js";

export const modelsList = defineOp({
  name: "models.list",
  summary: "List current API models and whether each can run a Captain thread.",
  description:
    "Read live model availability from /v1/models. The endpoint supplies ids, names, providers, " +
    "and Captain eligibility; friendly aliases and defaults remain local configuration.",
  effect: "read",
  input: z.object({}),
  output: ListModelsResponseSchema,
  async run(_args, ctx) {
    return resources(ctx).models.list();
  },
});
