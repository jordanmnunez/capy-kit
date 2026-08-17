# capy-kit — target design

> Architecture target, not an as-built inventory. See `README.md` and `PLAN.md` for current capability coverage.

capy-kit is a faithful typed interface to Capy’s current public API, plus small mechanical conveniences. It deliberately does not orchestrate, gate, or decide how coding work should be done.

## Design principle

**capy-kit manages Capy; Capy manages the work.**

- Map the official thread-centric runtime API faithfully.
- Add only mechanical conveniences: typed transport, validation, pagination, `delegate`, `wait`, rendering, and shell adapters.
- Tell Captain the goal and quality bar in the prompt; do not recreate Captain’s planning, testing, review, or iteration locally.
- Keep optional workflow opinion in higher-level consumers such as `capy-fleet-hq`.

## Source of truth and boundary

`spec/capy.openapi.json` is vendored from `https://docs.capy.ai/openapi.json`; the current **2026-08-17** snapshot has 21 paths and 24 operations. `npm run gen` creates the checked-in `packages/core/src/client/schema.d.ts`; `npm run gen:check` detects drift.

The public contract is intentionally narrow: threads/messages, read-only tasks, review controls, and usage. It does not publicly offer project discovery, model discovery, configuration or snapshots, tags, personal environment variables, automations, session tokens, task mutation, task diffs, or attachments. Their absence is a product boundary, not a gap to fill with private endpoints.

## Layers

| Surface | Current role | Target |
|---|---|---|
| `@capy-kit/core` | Shared transport, generated types, resource methods, and Ops | Faithful coverage of the published runtime contract |
| `capy` CLI | Explicit Citty projections of supported Ops plus local config commands | Mechanical projection of the supported Op roster |
| `capy-mcp` | Package scaffold | Server factory and stdio only after explicit implementation |
| Skills | Manually curated usage guides | Remain curated; optionally generate reference tables from `OPS` |

## One declaration model

Every user-facing capability begins as one `Op` in `packages/core/src/ops/`:

```ts
{ name, summary, input: zodSchema, output: zodSchema, effect, run(args, ctx) }
```

Resources are typed, small mappings over the published wire protocol. Ops own validation, effects, output contracts, and composition. The CLI parses and renders, and does not duplicate API logic.

## Runtime behavior

- Base URL: `https://api.capy.ai/api/v1`; requests carry `Authorization: Bearer <key>`.
- `CAPY_API_KEY` is the credential name.
- Thread list/create calls require a configured project ID. `capy init` and `capy projects` maintain local aliases; no core API call invents project discovery.
- Create uses a caller-stable `requestId`, so retries converge. Message sends are intentionally not retried automatically.
- Lists return `{items,cursor}`. A null cursor ends pagination; opaque cursors are passed through unchanged.
- Thread status is authoritative: `active` and `waiting` can progress, while `pending_user`, `error`, `ready_for_review`, `idle`, and `archived` settle.
- HTTP errors preserve status and Capy’s tagged body in a stable `CapyError` envelope; debug hooks redact authorization.

## Non-goals

- No fleet loops, triage, quality gates, approval requirements, review reconciliation, or GitHub implementation in core/CLI/MCP.
- No calls to unpublished or retired endpoints.
- No claim that every Op automatically exists in MCP or skills until those projections are built.
