import { CapyError } from "../client/errors.js";
import type { CapyContext } from "../client/context.js";

/** Resolve the effective project id (per-call arg wins over ctx default) or fail clearly. */
export function requireProject(argProjectId: string | undefined, ctx: CapyContext): string {
  const projectId = argProjectId ?? ctx.projectId;
  if (!projectId) {
    throw new CapyError({
      code: "no_project",
      message:
        "No project selected. Run `capy projects list` to see ids, then pass --project <id>, " +
        "set CAPY_PROJECT_ID, or run `capy init`.",
    });
  }
  return projectId;
}

/** Parse a CLI repo spec "owner/name@branch" into the API's {repoFullName, branch}. */
export function parseRepo(spec: string, fallbackBranch?: string): { repoFullName: string; branch: string } {
  const at = spec.lastIndexOf("@");
  if (at > 0) {
    return { repoFullName: spec.slice(0, at), branch: spec.slice(at + 1) };
  }
  if (fallbackBranch) return { repoFullName: spec, branch: fallbackBranch };
  throw new CapyError({
    code: "validation_error",
    message: `Repo "${spec}" needs a branch. Use "owner/name@branch" or pass --branch.`,
  });
}
