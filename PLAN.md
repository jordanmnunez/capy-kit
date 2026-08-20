# capy-kit — current API roadmap

Updated **2026-08-20**. The Capy public API is an organization-key-scoped runtime surface at `https://api.capy.ai/api/v1`. Its authoritative contract is vendored in `spec/capy.openapi.json`; the current snapshot has **31 paths and 37 operations**. `README.md` describes what can be run now, and `SPEC.md` records the architectural target.

## Product rules

1. **capy-kit manages Capy; Capy manages the work.** Map published runtime capabilities faithfully and keep helpers mechanical. Do not add fleet orchestration, readiness gates, approval blocking, retry policy, or review-provider judgment.
2. **Business logic starts as one `Op`.** Core owns validation and execution; the CLI only parses and renders. Every surfaced API capability must have a core resource method, Op, tests, and an explicit CLI projection.

## Current implementation

The core and CLI cover the public work-and-observe loop:

- create, list, get, rename, archive/unarchive, regenerate title, and interrupt threads;
- read thread messages and send `interrupt`, `queue`, or `steer` messages; cancel or immediately send a queued message;
- list a thread’s task tree, get a task, and read a task transcript;
- poll a thread with `wait`, summarize project work with `status`, read organization usage, list organization users, and organize threads with folders and pins;
- resolve default author attribution from top-level config, environment, or a fail-closed named profile, with explicit per-command override and suppression;
- start a pull-request review.

The registry has **33 Ops**, including the mechanical `delegate`, `wait`, and `status` composites. `capy init` and `capy projects` remain CLI-only configuration flows because project discovery is not public.

## Current public API boundary

The public specification exposes 37 HTTP operations:

| Domain | Official | Implemented | Remaining |
|---|---:|---:|---:|
| Threads and messages | 12 | 12 | — |
| Tasks | 3 | 3 | — |
| Organization users | 1 | 1 | — |
| Folders and pins | 6 | 6 | — |
| Usage | 1 | 1 | — |
| Reviews | 8 | 8 | — |
| Automations | 6 | 0 | 6 |
| **Total** | **37** | **31** | **6** |

Project discovery, models, tags, setup, snapshots, personal environment variables, session tokens, task mutation, task diffs, and attachments remain absent from the public contract. capy-kit must not revive them through undocumented routes. Automations are public but intentionally out of scope because they introduce persistent event-driven execution rather than a mechanical thread-control surface.

## Compatibility and correctness

- The base URL is `https://api.capy.ai/api/v1`; never append another `/api` or `/v1`.
- `CAPY_API_KEY` is the credential name.
- `CAPY_PROJECT_ID` and `CAPY_AUTHOR_ID` provide ambient CLI defaults. A selected profile ignores both and uses its own project/author identity unless explicitly overridden.
- Project IDs must come from user configuration or the app; they cannot be discovered through the API.
- Thread creation requires a caller-stable `requestId`. Do not automatically retry messages because the endpoint has no caller idempotency key.
- Lists return `{items,cursor}` and use a null cursor to signal completion. Thread lists use `cursor`; messages and tasks use `after`.
- Thread status is `active|waiting|pending_user|error|ready_for_review|idle|archived`. Polling continues through `active` and `waiting`; the other states settle.
- Errors are tagged JSON bodies. Callers should use HTTP status plus `_tag`, not mutable error prose.

## Current stopping point

No additional product surface is currently planned. MCP remains a private scaffold, automations remain out of scope, and hosted drift checking belongs only with a future deliberate CI or publishing effort.

Production smoke testing on 2026-08-20 verified organization-user listing, empty folder listing, reversible pin/unpin, and author-scoped creation followed by immediate archival. Successful folder-thread/file/unfile behavior remains unverified because the organization had no existing folder and the public API cannot create one.

## Definition of done for an API capability

- It is present in the vendored official specification.
- The shared transport performs the request.
- A core Op owns Zod input/output, effect, errors, and execution.
- The CLI is a thin projection with stable JSON output.
- Network-free tests cover request shape, validation, and failures.
- Documentation calls it current only after code is present.
