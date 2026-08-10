# capy-kit — legacy API status and roadmap

> Historical reference. The current Capy API is organization-key scoped; this document predates its migration.

Updated **2026-07-10**. This is the living implementation plan. `README.md` describes what users can
run now, `AGENTS.md` contains repository rules, and `SPEC.md` describes the target architecture.

## Product rules

1. **capy-kit manages Capy; Capy manages the work.** Map the API faithfully and keep conveniences
   mechanical. Do not put fleet orchestration, triage, readiness gates, retry policy, approval
   blocking, or review-provider logic in the faithful surfaces.
2. **Business logic starts as one `Op`.** Core owns validation and execution. Shells project Ops and
   add only shell concerns. Automatic projection is a goal; it is not yet implemented for every
   surface.

## Current status

The core SDK and CLI are shipped and used locally from source. The current registry has **11 Ops**:

- `delegate`
- `threads.list`, `threads.get`, `threads.stop`, `threads.message`, `threads.messages`
- `wait`, `status`
- `projects.list`, `projects.get`
- `models.list`

The CLI exposes those Ops plus the CLI-only `init` flow. It supports JSON output, redacted HTTP
debugging, full thread-list filters and pagination, thread-message steering, stable `delegate
--wait` JSON, and distinct wait exits for done (0), blocked (123), timeout (124), and archived (125).

The implementation also includes:

- generated OpenAPI wire types and hand-written Zod mirrors for implemented shapes;
- typed transport with authentication, timeout, idempotency-aware retry, `Retry-After`, and
  structured `CapyError`s;
- live model discovery (`id`, name, provider, and Captain eligibility), also used by `capy init`;
- fail-closed config/profile loading plus live name-first project selection in `capy init`, storing
  a verified canonical id when online or an explicitly caller-asserted id offline;
- independent Captain and builder model/reasoning selection at thread creation, including local
  defaults and explicit per-delegation overrides;
- network-free core/CLI tests plus an opt-in live smoke test;
- two manually maintained skills: faithful `capy` and opinionated `capy-fleet-hq`, including a
  reusable campaign/cross-project handoff contract.

The following are **not built yet**:

- the MCP server (the package contains a manifest and source placeholder only);
- automatic CLI/MCP/skill generation from `OPS`;
- `scripts/gen-skills.ts`, an `npm run gen:skills` script, or generated command tables;
- a checked-in hosted CI workflow;
- published npm packages or a plugin marketplace entry.

## What local use taught us

The highest-value improvements were not broad orchestration features; they were faithful controls
that remove friction from the normal loop:

- **Steering matters.** Reusing a thread's context with `threads.message` is much better than
  re-delegating. Queue-vs-interrupt delivery and caller-supplied `messageId` now make busy-thread
  steering safely deduplicable when a caller retries.
- **Observation must be faithful.** `status` defaults to active work, can default to the configured
  author on shared projects, and returns every PR rather than collapsing a stack to one PR.
- **`runState` is authoritative for waiting.** Live evidence showed `status=idle` with
  `runState=waiting` and `waitingOn=review`. Therefore `idle` alone is not done or ready to land.
  `ready` alone proves done; `blocked` and `archived` settle without proving success; and
  `running|stopping|queued|waiting` continue polling. Real no-work platform failures auto-archived,
  so archive now exits 125 rather than masquerading as success.
- **Automation needs stable contracts.** `delegate --wait --json` keeps delegate fields at the root,
  and wait exit codes distinguish blocked from timeout without JSON parsing.
- **Project discovery belongs in the happy path.** `projects.list|get` and a clear `no_project`
  error are essential when one installation drives multiple projects. `capy init` now offers a
  name-first live picker, rejects ambiguous typed names, and persists the canonical id. Global
  `--project` remains id-only so automation does not gain a discovery request or ID/name ambiguity;
  fleet views still require repeating project-scoped calls manually.
- **Selected authority must constrain mutations.** Thread message/stop are id-scoped API endpoints,
  so capy-kit preflights their thread identity whenever a project is selected and refuses a mismatch.
- **Shared-project defaults matter.** `CAPY_AUTHOR_EMAIL` prevents `status` from burying one user's
  work while preserving explicit author/origin overrides.
- **Model availability must be live.** `models.list` replaces raw HTTP discovery and lets `init`
  avoid stale or Captain-ineligible choices; aliases/defaults remain local policy.

These lessons set the next priority: deepen the work/observe surface before adding a new transport
surface solely for symmetry.

## OpenAPI refresh

The official OpenAPI document was refreshed on **2026-07-10**. It now has **26 paths / 37
operations**. Generated types are committed and `npm run gen:check` can detect local drift.

Notable changes from the previous vendored document:

- thread `runState` adds `stopping`;
- thread-list `origin` adds `github`;
- send-message supports `interrupt|queue`, caller-supplied `messageId` deduplication, and queued/pending response
  metadata;
- usage routing adds `external_xai`;
- the model list has current ids but still only supplies availability fields and
  `captainEligible`—not aliases or a default;
- automations have versioned multi-trigger configurations;
- six warm-pool operations are absent from the public spec. Warm-pool is therefore unsupported and
  de-publicized, though that does not prove the server routes were deleted.

The official surface covers 37 HTTP operations. capy-kit implements 9 of them as resource+Op-backed
capabilities; its registry has 11 Ops because `wait` and `status` are mechanical composites.

| Domain | Official | Implemented | Missing |
|---|---:|---:|---|
| Threads | 9 | 6 | archive, unarchive, session token |
| Thread/project tags | 3 | 0 | set thread tags; list/create project tags |
| Tasks | 2 | 0 | get, diff |
| Projects | 2 | 2 | — |
| Models | 1 | 1 | — |
| Usage | 1 | 0 | usage/cost |
| Setup | 2 | 0 | get, update |
| Snapshots | 2 | 0 | get, update |
| Browser snapshots | 5 | 0 | list, create, get, update, delete |
| Personal environment variables | 3 | 0 | list, upsert, delete |
| Automations | 6 | 0 | list, create, get, update, delete, trigger |
| Sessions | 1 | 0 | verify |
| **Total** | **37** | **9** | **28** |

The implemented create/message endpoints still have useful passthrough gaps. `delegate` does not yet
expose impersonation, speed, browser snapshot ids, Slack channel configuration, or
reliability-investigation context. `threads.message` does not yet expose speed/build settings or
browser snapshot ids. Keep these faithful and optional rather than turning them into local policy.

### Upstream API gaps worth requesting

Some observed friction cannot be fixed faithfully from the current public API:

- Usage requires an organization id, but there is no current-user/organization discovery endpoint
  and project responses do not carry the organization id.
- Archived threads can retain a stale non-archived `runState`, and there is no canonical outcome or
  archive reason. A consistent final state plus outcome/reason would remove the current unknown case.
- Thread responses omit creator/author and origin even though list filters accept author/origin, so
  status/audit rows cannot display those values.
- Models omit the server default, aliases, and supported reasoning/speed/build capabilities; live
  availability prevents a stale picker but cannot eliminate stale local capability assumptions.
- There is no lifecycle event stream, webhook, or long-poll endpoint, so faithful waiting repeatedly
  GETs a thread (one local wait required 123 polls).
- Cross-project thread listing would make HQ aggregation cheaper, although a higher-level skill can
  aggregate project-scoped calls without changing core semantics.

## Prioritized roadmap

### P0 — keep the shipped loop correct

- Keep generated types, model enums, Zod mirrors, fixtures, and wait semantics synchronized with the
  refreshed spec.
- Preserve message queue/deduplication fields and the status `github` origin filter.
- Retain regression coverage for `status=idle` plus a nonterminal `runState`, and for archived
  status with a stale non-archived `runState`.
- Audit docs and skills whenever CLI JSON or exit-code contracts change.

### P1 — complete the high-use work and observe surface

Implement each capability as an Op, then project it into the CLI:

- remaining thread lifecycle: archive, unarchive, tags, and session token;
- tasks: get and diff;
- project tags, especially tag discovery/creation for delegation workflows;
- usage/cost;
- setup get/update, which local config-as-code already consumes through raw HTTP;
- any useful create/message passthroughs newly present in the spec, such as speed and browser
  snapshot ids (plus message-time build settings), without inventing policy around them.

Improve discovery and observation without turning core into a fleet judge:

- if repeated use justifies it, add a separate `--projectName` selector that performs exact unique
  matching and rejects zero/multiple matches; do not overload canonical/offline `--project` ids;
- keep `status` project-scoped, but make the HQ skill aggregate configured projects and query both
  active and idle candidates so `idle+waiting` work is not hidden;
- faithfully surface author/origin in list/status rows when the API response provides them;
- make usage's required organization context discoverable or return a precise configuration error.

This group comes first because it closes observed local workflow gaps while preserving Captain's
context and the CLI's simple automation contract.

### P2 — environment and automation parity

Add Ops/resources for setup, snapshots, browser snapshots, personal environment variables,
automations, and session verification. Automation schemas must support the official versioned,
multi-trigger forms rather than the older single-cron fiction. Do not add warm-pool controls while
they are absent from the public spec.

### P3 — choose and build additional projections deliberately

Decide priority from actual consumers before calling MCP “next.” The choices are:

- implement the MCP server factory and stdio transport from `OPS`;
- automate more of the Citty projection;
- generate reference tables for the existing skills;
- package/publish the source and install experience.

Whichever projection is chosen, its roster must be derived from `OPS`, annotations/metadata must be
mechanical, and business logic must stay in core. Streamable-HTTP MCP requires an explicit remote
authentication design before production use.

## Definition of done for an API capability

- It is based on an operation and types in the vendored official spec.
- Its resource method goes through the shared transport.
- Its `Op` owns Zod input/output, effect, errors, and execution.
- Implemented shells only adapt arguments and render/transport the result.
- Pagination follows all pages where requested.
- Network-free tests cover success, errors, validation, and any stable JSON/exit contract.
- Docs describe it as current only after the code is present.

## Decisions that remain in force

- TypeScript, Citty, Zod, generated OpenAPI types, ESM bins, and Node >=18 remain the foundation.
- The public, thread-centric API is authoritative; the old task-centric tool is not.
- Model aliases are static conveniences today. `/v1/models` is availability data, not an alias map.
- No triage/gate/approve/review-provider layer in core, CLI, or MCP.
- Rich fleet workflow belongs in `capy-fleet-hq`, above the faithful CLI.
