import { CapyError } from "../client/errors.js";
import type { CapyContext } from "../client/context.js";

/** Resolve the effective project id (per-call arg wins over ctx default) or fail clearly. */
export function requireProject(argProjectId: string | undefined, ctx: CapyContext): string {
  const projectId = argProjectId ?? ctx.projectId;
  if (!projectId) {
    throw new CapyError({
      code: "no_project",
      message:
        "No project selected. Pass --project <name-or-id>, set CAPY_PROJECT_ID, or run `capy init`.",
    });
  }
  return projectId;
}
