# AGENTS.md — capy-kit

This repo is **capy-kit**: a TypeScript toolkit for the thread-centric Capy API
(`https://capy.ai/api`, bearer `CAPY_API_KEY`). The SDK/core and CLI are usable today. The MCP
package is a scaffold, and the two shipped skills are maintained manually. Read this file before
working here, then use `README.md` for the user-facing surface, `PLAN.md` for current status and
roadmap, and `SPEC.md` for the target architecture.

## Stay out of Capy's way

**capy-kit manages Capy; Capy manages the work.** It provides a faithful interface plus small,
mechanical conveniences such as auto-pagination, `wait`, and `delegate`. It does not add fleet
loops, triage recommendations, quality gates, retry-cap iteration, approval blocking, or its own
GitHub/review implementation. Tell Captain the goal and quality bar in the prompt; surface Capy's
state and controls without deciding how the work should be done.

The optional `capy-fleet-hq` skill may add workflow opinions on top of the CLI. Those opinions do
not belong in core, the CLI, or a future MCP server.

## The one rule

Every shell-exposed capability starts as one `Op` in `packages/core/src/ops/`:

```ts
{ name, summary, input: zodSchema, output: zodSchema, effect, run(args, ctx) }
```

Core owns business logic and returns data; shells only parse/render/transport it. The current CLI
explicitly wires registered ops into its Citty tree and adds only shell concerns (`init`, output,
debugging, and `delegate --wait`). Automatic CLI/MCP/skill generation remains target architecture,
not current fact. Until those generators exist, adding an op means registering it in `OPS` and
explicitly projecting it into each implemented surface. Never duplicate an op's API logic in a
shell.

## Legacy API layout and surface

> Historical only. The current API migration is represented by `packages/core/src/client/current-schema.ts`; do not use the legacy API facts below for new work.

```text
packages/core/   @capy-kit/core — transport, generated wire types, resources, 11 Ops, rendering
packages/cli/    @capy-kit/cli  — built `capy` CLI over those Ops
packages/mcp/    @capy-kit/mcp  — package manifest + source placeholder; no server yet
spec/            vendored Capy OpenAPI 3.1 document
skills/capy/     manual faithful-use skill
skills/capy-fleet-hq/ manual opinionated fleet/HQ skill
scripts/         README only; skill-table generation is planned
```

The eleven registered Ops are:

- `delegate`
- `threads.list`, `threads.get`, `threads.stop`, `threads.message`, `threads.messages`
- `wait`, `status`
- `projects.list`, `projects.get`
- `models.list`

`init` is intentionally a CLI-only configuration concern. `pollUntilTerminal`, `waitForThread`,
`listAllThreads`, and resource methods are SDK helpers rather than registered Ops.

The core is two layers: a hand-written transport (`client/transport.ts`) for auth, retry,
`Retry-After`, timeout, error mapping, and redacted debug hooks; then typed resources and Ops over
the generated OpenAPI types. Tests inject `fetch` and run without network, apart from the opt-in
live smoke test.

## Clean-room note

The prior `capy-cli` is an idea source only; do not copy its code or vocabulary. In particular:

- The real API is thread-centric. Work creation and controls live under `/v1/threads`; tasks are
  read-only at `/v1/tasks/{id}` and `/diff`.
- Do not invent state names or hardcode new model availability. `GET /v1/models` returns available
  models (`id`, `name`, `provider`, `captainEligible`); it does **not** return aliases or a default.
  `opus`/`sonnet`/`haiku` are currently static capy-kit conveniences, and the default comes from
  config/environment with a static fallback.
- Do not import the prior tool's triage, gates, approval, retry, or review-provider model.

## Runtime and dependencies

Node **>=18** is the declared runtime contract; Bun is the development fast path. Binaries build to
ESM with `tsup`. Treat the dependency versions in the package manifests as authoritative and do not
upgrade them casually, especially Citty, `@clack/prompts`, or Zod. Select and pin the MCP SDK when
that currently empty scaffold is implemented.

## OpenAPI codegen

The vendored spec is `spec/capy.openapi.json`, refreshed from
`https://docs.capy.ai/openapi.json` on **2026-07-10**. It currently contains **26 paths and 37
operations**.

```bash
npm run gen        # regenerate packages/core/src/client/schema.d.ts
npm run gen:check  # regenerate, then fail if the generated file differs
```

The generated file is committed for offline builds. There is currently no checked-in CI workflow;
`gen:check` is an available local/package script, not a claim about hosted CI. Hand-written Zod
mirrors cover only implemented wire shapes and have compile-time equality guards.

The 2026-07-10 spec adds or clarifies facts the implementation must preserve:

- thread `runState` includes `stopping`;
- thread-list `origin` includes `github`;
- thread messages support `mode: interrupt|queue`, a caller `messageId` deduplication id, and responses
  `sent|queued|pending` with optional append metadata;
- usage routing includes `external_xai`;
- automations support versioned, multi-trigger configuration;
- `/v1/models` reports availability and `captainEligible`, not capy-kit aliases/defaults.

Six warm-pool operations that appeared in the 2026-06-26 document are no longer in the public
spec. Treat warm-pool as **de-publicized and unsupported by capy-kit**; absence from the document is
not proof that the server routes were deleted.

## Build and test

```bash
bun install
npm run gen
npm run typecheck
npm test
npm run build
```

There is no `npm run gen:skills` yet. Do not document or invoke it until the generator and package
script actually exist.

## Conventions

- Core returns structured data and never reads `process.argv` or prints. Output format is a shell
  concern.
- Project and org context are per call. Explicit `--project` wins. An explicit profile must exist;
  without `--project`, its effective file-configured project ignores ambient `CAPY_PROJECT_ID`.
  Without a profile, process env then dotenv then top-level config supply the project. Only missing
  files are absent; malformed/unreadable configuration fails validation.
- Thread message/stop endpoints are id-scoped, so when context selects a project their Ops must GET
  the thread first and refuse a cross-project mutation. Unscoped SDK calls may use the unique id.
- Throw `CapyError` with a literal code. The CLI maps known codes to stable exit codes and emits a
  structured JSON envelope under `--json`.
- `wait` uses `runState` to distinguish idle work that is ready from work still waiting: `ready` is
  done; `blocked` settles without proving success; and `running|stopping|queued|waiting` can still
  progress. An `idle` status alone is not done. Archived status/runState settles as unknown because
  live archived threads can retain a stale runState. CLI exits 0 for done, 123 for blocked, 124 for
  timeout, and 125 for archived/stopped with outcome unknown.
- `status` defaults to active threads and, when `CAPY_AUTHOR_EMAIL` is configured, to that author's
  work. It surfaces every pull request in `pullRequests` while retaining `pr` as a first-PR
  convenience.
- Every list must preserve cursor pagination; `--all`/`listAll` must follow all pages.
- Build request bodies with `body !== undefined`, not truthiness, so valid falsy bodies are sent.
- Prefer `CAPY_API_KEY` in environment/keychain. Both `~/.capy/config.json` and `~/.capy/.env` must
  be mode 0600; context loading refuses either file when group/other-readable. Persist secrets only
  with explicit opt-in and redact `Authorization` from debugging.

## Don't

- Don't put API/business logic in CLI, MCP, skills, or renderers.
- Don't claim an op automatically appears in MCP or skills until those projections exist.
- Don't add orchestration or judgment to the faithful surfaces.
- Don't add `gh`, Greptile, or local review reconciliation to core/CLI/MCP.
- Don't treat `/v1/models` as an alias map or default-model endpoint.
- Don't expose warm-pool controls unless they return to the official spec and are deliberately
  re-adopted.
- Don't invent endpoints, wire fields, enums, or terminal states; derive them from the vendored
  spec and update generated types plus hand-written mirrors together.

## Official API coverage

The public spec's 37 operations cover threads (list/create/get, stop/archive/unarchive,
session-token, message/history/tags), tasks and diffs, projects and project tags, models, usage,
session verification, setup, snapshots, browser snapshots, personal environment variables, and
automations. Only the eleven Ops listed above are surfaced today. See `PLAN.md` for the prioritized
parity roadmap; the existence of an official endpoint does not imply capy-kit implements it.
