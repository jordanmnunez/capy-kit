# capy-kit — current API roadmap

Updated **2026-08-17**. The Capy public API is a focused, organization-key-scoped runtime surface at `https://api.capy.ai/api/v1`. Its authoritative contract is vendored in `spec/capy.openapi.json`; the current snapshot has **21 paths and 24 operations**. `README.md` describes what can be run now, and `SPEC.md` records the architectural target.

## Product rules

1. **capy-kit manages Capy; Capy manages the work.** Map published runtime capabilities faithfully and keep helpers mechanical. Do not add fleet orchestration, readiness gates, approval blocking, retry policy, or review-provider judgment.
2. **Business logic starts as one `Op`.** Core owns validation and execution; the CLI only parses and renders. Every surfaced API capability must have a core resource method, Op, tests, and an explicit CLI projection.

## Current implementation

The core and CLI cover the public work-and-observe loop:

- create, list, get, rename, archive/unarchive, regenerate title, and interrupt threads;
- read thread messages and send `interrupt`, `queue`, or `steer` messages; cancel or immediately send a queued message;
- list a thread’s task tree, get a task, and read a task transcript;
- poll a thread with `wait`, summarize project work with `status`, and read organization usage;
- start a pull-request review.

The registry has **25 Ops**, including the mechanical `delegate`, `wait`, and `status` composites. `capy init` and `capy projects` remain CLI-only configuration flows because project discovery is not public.

## Current public API boundary

The public specification exposes 24 HTTP operations:

| Domain | Official | Implemented | Remaining |
|---|---:|---:|---:|
| Threads and messages | 12 | 12 | — |
| Tasks | 3 | 3 | — |
| Usage | 1 | 1 | — |
| Reviews | 8 | 8 | — |
| **Total** | **24** | **24** | **0** |

Capy’s migration guide also establishes a hard negative boundary. Project discovery, models, tags, setup, snapshots, personal environment variables, automations, session tokens, task mutation, task diffs, and attachments are no longer public API capabilities. capy-kit must not revive them through undocumented routes or retain roadmap commitments to them. Manage those capabilities in Capy’s app.

## Compatibility and correctness

- The base URL is `https://api.capy.ai/api/v1`; never append another `/api` or `/v1`.
- `CAPY_API_KEY` is the credential name.
- Project IDs must come from user configuration or the app; they cannot be discovered through the API.
- Thread creation requires a caller-stable `requestId`. Do not automatically retry messages because the endpoint has no caller idempotency key.
- Lists return `{items,cursor}` and use a null cursor to signal completion. Thread lists use `cursor`; messages and tasks use `after`.
- Thread status is `active|waiting|pending_user|error|ready_for_review|idle|archived`. Polling continues through `active` and `waiting`; the other states settle.
- Errors are tagged JSON bodies. Callers should use HTTP status plus `_tag`, not mutable error prose.

## Next work

1. Decide whether the MCP package should project the existing `OPS` registry; do not claim it exists until a server is implemented.
2. Add a hosted drift check for `npm run gen:check` when CI and publishing are deliberately introduced.

## Definition of done for an API capability

- It is present in the vendored official specification.
- The shared transport performs the request.
- A core Op owns Zod input/output, effect, errors, and execution.
- The CLI is a thin projection with stable JSON output.
- Network-free tests cover request shape, validation, and failures.
- Documentation calls it current only after code is present.
