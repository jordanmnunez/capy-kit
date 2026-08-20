import { describe, expect, it } from "vitest";
import { CapyError, delegate, foldersFile, foldersPin, threadsMessage, threadsRename } from "@capy-kit/core";
import { apiArgsForOp, argsForOp } from "../src/build.js";

describe("CLI API projection", () => {
  it("projects documented model fields into the create-thread request object", () => {
    expect(argsForOp(delegate).modelId).toMatchObject({ type: "string", required: true });
    expect(apiArgsForOp(delegate, { message: "work", requestId: "req-1", authorId: "usr_1", modelId: "openai/gpt-5.6-sol", reasoningMode: "high", fast: true, pro: false })).toEqual({ message: "work", requestId: "req-1", authorId: "usr_1", model: { modelId: "openai/gpt-5.6-sol", reasoningMode: "high", modes: { fast: true, pro: false } } });
    expect(() => apiArgsForOp(delegate, { message: "work", requestId: "req-1" })).toThrow("--model-id is required");
  });

  it("supports no-author as an explicit opt-out of the configured default", () => {
    expect(argsForOp(delegate)).toHaveProperty("authorId");
    expect(apiArgsForOp(delegate, { message: "work", requestId: "req-1", modelId: "openai/gpt-5.6-sol", noAuthor: true })).toEqual({ message: "work", requestId: "req-1", authorId: null, model: { modelId: "openai/gpt-5.6-sol" } });
    expect(() => apiArgsForOp(delegate, { message: "work", requestId: "req-1", modelId: "openai/gpt-5.6-sol", authorId: "usr_1", noAuthor: true })).toThrow("either --author-id or --no-author");
  });

  it("projects folder IDs and comma-separated thread IDs as positionals", () => {
    expect(argsForOp(foldersFile)).toMatchObject({ folderId: { type: "positional", required: true }, threadIds: { type: "positional", required: true } });
    expect(argsForOp(foldersPin)).toMatchObject({ threadIds: { type: "positional", required: true }, userId: { type: "string", required: false } });
  });

  it("uses the same model projection for messages and does not expose a scalar model flag", () => {
    expect(argsForOp(threadsMessage)).toMatchObject({ modelId: { type: "string" }, reasoningMode: { type: "string" }, fast: { type: "boolean" }, pro: { type: "boolean" } });
    expect(argsForOp(threadsMessage)).not.toHaveProperty("model");
    expect(apiArgsForOp(threadsMessage, { id: "jam_1", text: "focus", modelId: "openai/gpt-5.6-sol", pro: true })).toEqual({ id: "jam_1", text: "focus", model: { modelId: "openai/gpt-5.6-sol", modes: { pro: true } } });
  });

  it("projects clear-title to the API null value", () => {
    expect(argsForOp(threadsRename)).toHaveProperty("clearTitle");
    expect(apiArgsForOp(threadsRename, { id: "jam_1", clearTitle: true })).toEqual({ id: "jam_1", title: null });
    expect(() => apiArgsForOp(threadsRename, { id: "jam_1", title: "Manual", clearTitle: true })).toThrow(CapyError);
  });
});
