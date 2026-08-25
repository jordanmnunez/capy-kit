import { z } from "zod";
import { CapyError, isCapyError } from "../client/errors.js";
import { resources } from "../client/resources.js";
import { THREAD_STATUSES } from "../model.js";
import { defineOp } from "./define.js";
import { requireProject } from "./shared.js";
const model = z.object({ modelId: z.string().min(1), reasoningMode: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).optional(), modes: z.object({ fast: z.boolean().optional(), pro: z.boolean().optional() }).optional() });
const threadUrl = (id: string) => `https://capy.ai/thread/${encodeURIComponent(id)}`;
export const delegate = defineOp({ name: "delegate", summary: "Create and start a Capy thread.", effect: "create", input: z.object({ message: z.string().min(1), requestId: z.string().min(1).max(191), title: z.string().optional(), model, machineSize: z.enum(["small", "medium", "large", "ultra", "hyper", "bigguy"]).optional(), authorId: z.string().min(1).nullable().optional() }), output: z.object({ threadId: z.string(), projectId: z.string().nullable(), title: z.string().nullable(), status: z.enum(THREAD_STATUSES), createdAt: z.string(), url: z.string().url(), pinnedForUserId: z.string().optional() }), async run(a, c) {
  const projectId = requireProject(undefined, c);
  const authorId = a.authorId === undefined ? c.authorId : a.authorId;
  if (c.delegateAuthorId !== undefined && authorId !== c.delegateAuthorId) {
    throw new CapyError({ code: "validation_error", message: `Local delegation policy requires author ${c.delegateAuthorId}; remove --noAuthor or the conflicting --authorId.` });
  }
  const { authorId: _authorId, ...body } = a;
  const api = resources(c);
  const t = await api.threads.create({ ...body, projectId, ...(authorId !== null && authorId !== undefined ? { authorId } : {}) });
  const url = threadUrl(t.id);
  if (c.delegatePinUserId !== undefined) {
    try {
      const result = await api.folders.pin({ threadIds: [t.id], userId: c.delegatePinUserId });
      const outcome = result.outcomes.find((item) => item.threadId === t.id)?.outcome;
      if (outcome !== "ok") throw new CapyError({ code: "api_error", message: `Capy returned ${outcome ?? "no outcome"}.` });
    } catch (error) {
      const cause = isCapyError(error) ? error : undefined;
      throw new CapyError({
        code: cause?.code ?? "api_error",
        message: `Thread ${t.id} was created as ${authorId ?? "an unattributed author"}, but automatic pinning for ${c.delegatePinUserId} failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { threadId: t.id, url, pinUserId: c.delegatePinUserId },
        cause: error,
      });
    }
  }
  return { threadId: t.id, projectId: t.projectId, title: t.title, status: t.status, createdAt: t.createdAt, url, ...(c.delegatePinUserId !== undefined ? { pinnedForUserId: c.delegatePinUserId } : {}) };
} });
