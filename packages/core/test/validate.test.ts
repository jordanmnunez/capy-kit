import { describe, expect, it } from "vitest";

import { threadsGet } from "../src/index.js";
import { makeThread } from "./fixtures.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

// The ctx.validate toggle gates OUTPUT validation (the response boundary). Input is always
// validated; output only when validate=true. Cover both branches.
describe("ctx.validate output boundary", () => {
  const withExtra = () => ({ ...makeThread(), unexpectedField: 123 });

  it("passes the response through verbatim when validate=false (production default)", async () => {
    const { fetch } = makeMockFetch(() => ({ json: withExtra() }));
    const out = await threadsGet.run({ id: "jam_x" }, testContext({ fetch, validate: false }));
    expect(out.id).toBe("jam_abc123");
    expect((out as Record<string, unknown>).unexpectedField).toBe(123);
  });

  it("rejects an unexpected response shape (bad_response) when validate=true", async () => {
    const { fetch } = makeMockFetch(() => ({ json: withExtra() }));
    await expect(
      threadsGet.run({ id: "jam_x" }, testContext({ fetch, validate: true })),
    ).rejects.toMatchObject({ code: "bad_response" });
  });
});
