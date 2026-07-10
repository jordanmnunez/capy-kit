import { describe, expect, it } from "vitest";

import { modelsList } from "../src/index.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

describe("models.list", () => {
  it("lists live model availability without project context", async () => {
    const response = {
      models: [
        { id: "gpt-5.6-sol" as const, name: "GPT-5.6 Sol", provider: "OpenAI", captainEligible: true },
        { id: "gpt-5.4-mini" as const, name: "GPT-5.4 Mini", provider: "OpenAI", captainEligible: false },
      ],
    };
    const { fetch, calls } = makeMockFetch(() => ({ json: response }));
    const out = await modelsList.run({}, testContext({ fetch, projectId: undefined }));
    expect(calls[0]!.path).toBe("/api/v1/models");
    expect(calls[0]!.query.toString()).toBe("");
    expect(out).toEqual(response);
  });
});
