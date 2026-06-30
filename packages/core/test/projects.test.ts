import { describe, expect, it } from "vitest";

import { projectsGet, projectsList, type ListProjectsResponse, type Project } from "../src/index.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: "proj_abc",
    name: "centralapp",
    description: null,
    taskCode: "CEN",
    repos: [{ repoFullName: "owner/centralapp", branch: "main" }],
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:05:00.000Z",
    ...over,
  };
}

function makeProjectsPage(over: Partial<ListProjectsResponse> = {}): ListProjectsResponse {
  return { items: [makeProject()], nextCursor: null, hasMore: false, ...over };
}

describe("projects.list", () => {
  it("GETs /v1/projects without requiring a project context", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeProjectsPage() }));
    const out = await projectsList.run({}, testContext({ fetch, projectId: undefined }));
    expect(calls[0]!.path).toBe("/api/v1/projects");
    expect(calls[0]!.query.has("projectId")).toBe(false);
    expect(out.items[0]!.id).toBe("proj_abc");
  });

  it("auto-follows nextCursor when --all is set", async () => {
    const { fetch, calls } = makeMockFetch((call) =>
      call.attempt === 1
        ? { json: makeProjectsPage({ items: [makeProject({ id: "proj_a" })], nextCursor: "c2", hasMore: true }) }
        : { json: makeProjectsPage({ items: [makeProject({ id: "proj_b" })], nextCursor: null, hasMore: false }) },
    );
    const out = await projectsList.run({ all: true }, testContext({ fetch }));
    expect(out.items.map((p) => p.id)).toEqual(["proj_a", "proj_b"]);
    expect(calls[1]!.query.get("cursor")).toBe("c2");
  });
});

describe("projects.get", () => {
  it("GETs /v1/projects/{id}", async () => {
    const { fetch, calls } = makeMockFetch(() => ({ json: makeProject({ id: "proj_xyz" }) }));
    const out = await projectsGet.run({ id: "proj_xyz" }, testContext({ fetch }));
    expect(calls[0]!.path).toBe("/api/v1/projects/proj_xyz");
    expect(out.id).toBe("proj_xyz");
  });
});
