import { describe, expect, it } from "vitest";

import {
  CreateThreadResponseSchema,
  ListThreadsResponseSchema,
  ThreadListItemSchema,
} from "../src/index.js";
import { makeCreateResponse, makePage, makeThread } from "./fixtures.js";

// The recorded fixtures are the wire contract. They must parse cleanly through the zod
// mirrors that back `ctx.validate` (and the mirrors are kept equal to the GENERATED types
// by the Exact<> assertions in client/schemas.ts).
describe("contract: fixtures validate against the registry schemas", () => {
  it("ThreadListItem", () => {
    expect(() => ThreadListItemSchema.parse(makeThread())).not.toThrow();
  });

  it("ListThreadsResponse", () => {
    expect(() => ListThreadsResponseSchema.parse(makePage())).not.toThrow();
  });

  it("CreateThreadResponse", () => {
    expect(() => CreateThreadResponseSchema.parse(makeCreateResponse())).not.toThrow();
  });

  it("rejects an unknown extra key (strict) and a bad enum", () => {
    expect(() => ThreadListItemSchema.parse({ ...makeThread(), nope: 1 })).toThrow();
    expect(() => ThreadListItemSchema.parse({ ...makeThread(), status: "failed" })).toThrow();
  });
});
