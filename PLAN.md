# capy-kit — PLAN

The planning doc to start work here. Read alongside `AGENTS.md` (conventions) and `SPEC.md` (full design + examples).

## Status: scaffolded, not yet implemented
This repo currently contains: the design (`SPEC.md`), conventions (`AGENTS.md`), the **vendored Capy OpenAPI spec** (`spec/capy.openapi.json`), workspace + toolchain config, and package stubs (`packages/core|cli|mcp`). No source yet — that's the kickoff agent's job (see *Kickoff*).

## What we're building (one paragraph)
A TypeScript toolkit that wraps the real, thread-centric Capy API behind ONE typed "operations" core, projected into four mechanically-thin surfaces: a typed SDK (`@capy-kit/core`), a CLI (`capy`), an MCP server (`capy-mcp`, stdio + streamable-HTTP), and Claude Code skills. It is **unopinionated**: a faithful interface to the API plus skills to **manage Capy and its environment** — it does not orchestrate, gate, or decide how coding work gets done.

## The two rules
1. **capy-kit manages Capy; Capy manages the work.** Faithful API mapping + thin conveniences (auto-pagination, a poll `wait`, a one-call `delegate`). NO fleet loops, NO triage buckets/recommendations, NO quality gates / readiness, NO retry-cap `iterate`, NO `approve`-blocking, NO GitHub/Greptile review re-implementation. Quality comes from telling Capy the bar in the prompt and letting Captain handle it.
2. **Everything is an `Op`, declared once** in `packages/core/src/ops/`. The CLI tree, MCP tools, and skill tables are *projections* of the `OPS` registry — no business logic in any shell. Add one op → it appears in all four surfaces.

## Verified foundations (don't re-litigate these)
- **Runtime:** Node ≥18 (this machine resolves Node 22.x; the design sandbox had 18.20.8 — pins are conservative and work on both). Bins build to ESM JS via `tsup` so `npm i -g` works on plain Node; **Bun is the dev/install fast path**.
- **Deps (npm-latest confirmed 2026-06-26):** `citty@0.2.2` (no engine constraint — chosen over commander, which needs Node ≥20/≥22), `zod@4.4`, `@modelcontextprotocol/sdk@1.29.0`, `@clack/prompts@^0.11` (pinned — `@1.6` needs Node ≥20.12), dev: `openapi-typescript@7.13`, `openapi-fetch@0.17`, `tsup@8.5`, `vitest@4.1`, `typescript` (latest 6.x exists; stubs pin `^5.7` — bump deliberately).
- **MCP SDK signature (verified):** `registerTool(name, {description, inputSchema, outputSchema, annotations}, cb)`, `StdioServerTransport` + `StreamableHTTPServerTransport`; accepts `zod ^3.25 || ^4.0` so `op.input.shape` feeds it directly.

## Resolved API facts (from the vendored spec — the design left these open; they're answered)
See the table in `SPEC.md` / `AGENTS.md`. Headlines:
- **Task status:** `backlog|queued|in_progress|needs_review|completed|error|archived` (it's **`error`**, not `failed`).
- **Thread:** `status` `active|idle|archived` + richer `runState` `running|queued|waiting|blocked|ready|archived` (+ `waitingOn`/`blockedOn`/`pendingWakeups`).
- **`Task.threadId` exists**; **`/v1/usage` returns `currency` cost** (+ `routed` enum). Real wire-type names: `ThreadListItem`, `Task`, `UsageResponse`, `CreateThreadBody`/`CreateThreadResponse`, `Setup`, `Automation`, … → `npm run gen` types them all.
- **No `approve` / quality-gate endpoint exists** — which is exactly why the unopinionated direction is the right fit. Merging is native to Capy/GitHub.

## Milestones (unopinionated; each independently reviewable as a Graphite branch)

- **M0 — Repo spine (½ day).** npm/Bun workspaces (core/cli/mcp), `tsup` build → ESM JS (engines ≥18), `vitest`, strict TS. Pin the verified deps. `bun install` clean; `npm run gen` generates `packages/core/src/client/schema.d.ts` from the vendored spec; typecheck green.
- **M1 — Usable in a day: transport + core + 6-command CLI.** `CapyTransport` (auth, retry honoring `Retry-After`, AbortSignal timeout, `{error}`→`CapyError` with the string-literal `code` union, `onRequest/onResponse` redacting `Authorization`, `body !== undefined`, `ctx.validate` toggle). Core ops: `delegate`, `threads.get`, `threads.list` (full filters) + `listAll`, `wait`/`pollUntilTerminal`. CLI: `init`, `delegate` (+`--wait`), `threads list`, `threads get`, `wait`, `status`. `model.ts` terminal sets from the spec enums (`idle`/`archived` thread; `completed`/`error`/`archived` task). Ops tested against a `mockTransport` (zero network) + one live smoke test gated behind `CAPY_API_KEY`.
- **M2 — MCP server.** `createCapyServer(ctx)` auto-registering every `OPS` entry via `registerTool` (verified signature; annotations derived from `op.effect`). Bins `capy-mcp` (stdio) + `capy-mcp-http` (streamable-HTTP; remote-auth flagged as pre-remote-use, stdio is the v1 path). Tool roster == the faithful op set.
- **M3 — Faithful work + observe surface.** Complete the thread/task ops & CLI: `threads message|messages|stop|archive|unarchive|tags`, `tasks get|diff`, `usage` (cost), `projects list|get`, `models` (alias cache from `/v1/models`), and a plain `status` dashboard (real `status`/`runState`/`waitingOn` — NO buckets/recommendations).
- **M4 — Environment management.** The `env` surface (SDK + CLI + MCP, auto from `OPS`): `setup` (vmSize/phases/commands/hooks), `vars` (project secrets), `pool` (warm-pool get/set/instances/test/clear), `snapshots`, `browser-snapshots`, `automations` (incl. cron + trigger). This is the "manage Capy's environment" core.
- **M5 — Skills + docs + publish.** Generate command tables from `capy commands --json` (CI drift check). Author the consumer `AGENTS.md` runbook (keychain-first) + the **four** skills: `capy-delegate`, `capy-work`, `capy-env`, `capy-usage` (two-tier card+manual; object model + guardrails; **no fleet/gate loop**). Publish `@capy-kit/*`.

> Sequencing note: the spec is **already vendored**, so codegen runs in M0/M1 — it is not a deferred step. Ship each milestone as its own Graphite branch (this is a non-Obsidian repo, so the global RPI→Graphite convention applies); set up a GitHub remote and `gt submit --stack` when ready.

## Still open — confirm against the LIVE API (do not guess)
- **Does `POST /v1/threads` auto-start work, or need a separate start?** `CreateThreadResponse` has a `runState`, suggesting it enqueues — verify with one real create call. Governs `delegate` semantics.
- **Real web-IDE URL scheme** for a thread (the `https://capy.ai/project/{projectId}/captain/{threadId}` form is inferred from capy-cli on an older API). Confirm before baking into `delegate` output.
- **Does `/v1/usage` need `orgId` you can self-serve**, and what unit `totals` uses (currency confirmed; confirm the field shape) — for the `usage` op.
- **Streamable-HTTP MCP auth** (`capy-mcp-http`): bearer-in-front + per-session ctx. v1 supports **stdio** (Claude Code); HTTP ships but its remote-auth story is a pre-remote-use task.
- **Models alias-cache TTL/refresh cadence** so `--opus`/`--sonnet` don't resolve to a stale id.

## Definition of done — M1 ("usable in a day")
- `bun install` clean; `npm run typecheck` + `npm test` green (ops vs `mockTransport`, zero network).
- `npm run gen` produces `client/schema.d.ts` from the vendored spec.
- `CapyTransport` with the retry/timeout/error/redaction behavior above.
- Core ops `delegate` / `threads.get` / `threads.list`+`listAll` / `wait`.
- The 6-command CLI; `capy delegate "…" --wait` works end-to-end.
- One live smoke test behind `CAPY_API_KEY` (skipped in CI without it).

## Kickoff
Hand the prompt from the chat to an **ultracode** agent, run **in this repo**. Work milestone-by-milestone as a Graphite stack; stop and surface the "Still open" items rather than guessing.

## Decision log
- **Name:** `capy-kit`. **TS over Python** (matches the MCP TS SDK and `openapi-typescript`; a separate ingest tool stays out of scope). **Citty over commander** (Node-18 safety).
- **Unopinionated pivot (2026-06-26):** dropped the fleet skill and the triage / quality-gate / readiness / `iterate` / `approve` / review-provider machinery from the original design. capy-kit surfaces faithful state + faithful controls and lets Capy manage how work is done. Skills are: delegate, work, env, usage.
- **Cut entirely:** background OS-scheduler watcher; heavy `@hey-api/openapi-ts` SDK gen (escape hatch only).
