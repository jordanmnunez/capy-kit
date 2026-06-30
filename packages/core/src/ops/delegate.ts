import { z } from "zod";

import { resources, type CreateThreadBody } from "../client/resources.js";
import { THREAD_RUN_STATES, THREAD_STATUSES, resolveModelAlias, threadUrl } from "../model.js";
import { csvArray, defineOp } from "./define.js";
import { parseRepo, requireProject } from "./shared.js";

const DelegateInput = z.object({
  prompt: z.string().min(1),
  // alias (opus/sonnet/haiku) or a full model id; resolved against MODEL_ALIASES.
  model: z.string().optional(),
  // "owner/name@branch" specs; branch falls back to --branch when omitted.
  repos: csvArray(z.string()).optional(),
  branch: z.string().optional(),
  tags: csvArray(z.string())
    .describe("Tag(s) to attach; each must ALREADY exist in the Capy project (create them in the app, or omit).")
    .optional(),
  attachmentUrls: csvArray(z.string()).optional(),
  projectId: z.string().optional(),
});

const DelegateResult = z.object({
  threadId: z.string(),
  projectId: z.string(),
  status: z.enum(THREAD_STATUSES),
  runState: z.enum(THREAD_RUN_STATES),
  waitingOn: z.array(z.string()),
  blockedOn: z.array(z.string()),
  model: z.string(),
  title: z.string().nullable(),
  url: z.string(),
  createdAt: z.string(),
});

export const delegate = defineOp({
  name: "delegate",
  summary: "Create a Captain thread and start work (returns id + clickable url).",
  description:
    "Hand a goal to Capy: POST /v1/threads creates AND starts the thread (Captain plans, " +
    "spawns tasks, tests, reviews, and iterates on its own). Tell it WHAT + the quality bar in " +
    "the prompt; capy-kit does not decide HOW Capy executes.",
  effect: "create",
  input: DelegateInput,
  output: DelegateResult,
  async run(args, ctx) {
    const projectId = requireProject(args.projectId, ctx);
    const model = resolveModelAlias(args.model) ?? ctx.defaultModel;

    const body: CreateThreadBody = { projectId, prompt: args.prompt };
    if (model) body.model = model as CreateThreadBody["model"];
    if (args.repos && args.repos.length > 0) {
      body.repos = args.repos.map((spec) => parseRepo(spec, args.branch));
    }
    if (args.tags && args.tags.length > 0) body.tags = args.tags;
    if (args.attachmentUrls && args.attachmentUrls.length > 0) body.attachmentUrls = args.attachmentUrls;

    const res = await resources(ctx).threads.create(body);
    return {
      threadId: res.id,
      projectId: res.projectId,
      status: res.status,
      runState: res.runState,
      waitingOn: res.waitingOn,
      blockedOn: res.blockedOn,
      model,
      title: res.title,
      url: threadUrl(ctx.webBaseUrl, res.projectId, res.id),
      createdAt: res.createdAt,
    };
  },
});
