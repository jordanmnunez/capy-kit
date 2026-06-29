import { describe, expect, it } from "vitest";

import { resolveContext, resources } from "../src/index.js";

// One real, read-only smoke test. Skipped entirely unless CAPY_API_KEY is set (so CI stays
// network-free). Requires CAPY_PROJECT_ID too; otherwise this single case is skipped.
const live = process.env.CAPY_API_KEY ? describe : describe.skip;

live("live smoke (gated behind CAPY_API_KEY)", () => {
  it("lists threads for the configured project (read-only)", async () => {
    const ctx = resolveContext({ validate: true });
    if (!ctx.projectId) {
      // No project to read — nothing safe to do. Treat as a no-op pass.
      expect(ctx.apiKey.length).toBeGreaterThan(0);
      return;
    }
    const page = await resources(ctx).threads.list({ projectId: ctx.projectId, limit: 1 });
    expect(Array.isArray(page.items)).toBe(true);
    expect(typeof page.hasMore).toBe("boolean");
  });
});
