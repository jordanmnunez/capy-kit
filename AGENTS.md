# AGENTS.md — capy-kit

This repo is **capy-kit**: a TypeScript toolkit wrapping the real, thread-centric **Capy API**
(`https://capy.ai/api`, bearer `CAPY_API_KEY`) behind ONE shared "operations" core, exposed through
four mechanically-thin shells — a typed SDK/library, a CLI (`capy`), an MCP server (`capy-mcp`), and
Claude Code skills. If you are an agent working in this repo, read this whole file first.

## Stay out of Capy's way (the design principle)

capy-kit **manages Capy; Capy manages the work.** It is a faithful interface to the API plus thin
conveniences (auto-pagination, a poll `wait`, a one-call `delegate`) and skills to manage Capy and its
environment. It does **not** orchestrate or judge the work: no fleet loops, no triage buckets /
recommendations, no quality gates / readiness, no retry-cap `iterate`, no `approve`-blocking, no
GitHub/Greptile review re-implementation. Quality comes from telling Capy the bar in the prompt and
letting Captain plan/run/test/review/iterate. Surface faithful state + faithful controls; don't decide
for Capy. (Full rationale in `SPEC.md`.)

## The one rule

**Everything is an `Op`, declared exactly once in `packages/core/src/ops/`.** An `Op` is
`{ name, summary, input(zod), output(zod), effect, run(args, ctx) }`. The CLI command tree, the MCP
tool roster, and the skill command tables are all *projections* of the `OPS` registry. There is
**no business logic in any shell** — a CLI command is `render(await op.run(args, ctx), fmt)`; an MCP
handler is `toMcpResult(await op.run(args, ctx))`; a skill runs `capy <verb> --json` and reads the JSON.

Consequence: to add a capability, add ONE `Op` and register it in `OPS`. It appears in all four
surfaces at once. **Never** hand-write a CLI command or an MCP tool that re-implements an op. The
previous-art tool (`capy-cli`) drifted to "25 tools in one doc, 21 in another" precisely because its
logic was copy-pasted across CLI and MCP — that failure mode is structurally impossible here, and you
must keep it that way.

## Layout

```
packages/core/   @capy-kit/core   — the SSOT: client/ (transport+resources), ops/ (+ ops/env/), render/, model.ts
packages/cli/    @capy-kit/cli    — bin "capy"      — Citty shell generated from OPS
packages/mcp/    @capy-kit/mcp    — bins "capy-mcp" (stdio) + "capy-mcp-http" (streamable-HTTP)
spec/            capy.openapi.json — vendored Capy OpenAPI 3.1 spec (PRESENT — from docs.capy.ai/openapi.json)
scripts/         gen-skills.ts    — regenerate skill command tables from OPS
skills/          shipped skill packages (capy-delegate, capy-work, capy-env, capy-usage) — symlinkable into ~/.claude or .agents/skills/
```

Core is two layers: a thin hand-written **transport** (`client/transport.ts`: auth, idempotency-aware
retry honoring `Retry-After`, AbortSignal timeout, `{error}`→`CapyError`, `onRequest/onResponse` seam)
over a typed **resource** client (`client/resources.ts`), plus a small **`ops/`** layer — faithful
resource ops + thin conveniences (`delegate`, `wait`, `usage`) and the **`ops/env/`** environment ops
(`setup`, `vars`, `pool`, `snapshots`, `browser-snapshots`, `automations`) — all called identically by
every shell. There is deliberately **no** `triage`/`assessReadiness`/`iterate`/`approve`/review layer.

## Clean-room note (read before touching anything)

There is a prior tool, **capy-cli**, used here ONLY as an *idea source* (patterns, data shapes, DX,
pitfalls). **Do not copy its code.** Two of its facts are stale and must NOT be reproduced:
1. It targets a **task-centric API** (`/tasks/{id}/start|pr`). The REAL API is **thread-centric**:
   `GET /v1/threads` is the list resource; tasks are read-only `GET /v1/tasks/{id}[/diff]`;
   create/message/stop/archive/tags hang off `/threads`. Trust the thread-centric API.
2. It hardcoded model ids (`claude-opus-4-6`) that are now stale. We fetch the alias map from
   `GET /v1/models`; the default model is `claude-opus-4-8`.

Also: capy-cli's whole "quality gates / triage / approve" model is an **opinion we deliberately drop**
(see *Stay out of Capy's way*). Borrow its robustness/DX, not its orchestration.

## Runtime & dependency pins (these are load-bearing — do not "upgrade" blindly)

Runtime contract is **Node ≥18** (this machine resolves Node 22.x; the design sandbox reported
18.20.8 — the pins below are conservative and work on both). Bins build to ESM JS with `tsup` so
`npm i -g` works under plain Node; `bun run` is the dev fast path.

- **CLI framework: `citty`** (no engine constraint). **Do NOT switch to `commander@14`/`@15`** —
  verified `commander@14` requires Node ≥20 and `@15` requires Node ≥22.12. (If commander is ever
  mandated, `commander@13.1.0` is the only Node-18-safe pin.)
- **`@clack/prompts@0.11`** (CLI-only, for `capy init`). **Do NOT bump to `@1.x`** — it requires Node
  ≥20.12. Used only in the `cli` package, never in core.
- **`zod@4.4`** — registry input/output schemas + optional boundary validation. Verified the MCP SDK
  (`@modelcontextprotocol/sdk@1.29.0`) accepts `zod ^3.25 || ^4.0`.
- **`@modelcontextprotocol/sdk@1.29.0`** — verified `registerTool(name, {description, inputSchema,
  outputSchema, annotations}, cb)` and both `StdioServerTransport` + `StreamableHTTPServerTransport`.

## Codegen workflow (the client is generated FROM the vendored spec)

The Capy OpenAPI 3.1 spec **is vendored** at `spec/capy.openapi.json` (from
https://docs.capy.ai/openapi.json, 2026-06-26; 31 endpoints). Generate the typed client FROM it — do
not hand-write `any` types and do not invent endpoints.

```bash
npm run gen      # = openapi-typescript spec/capy.openapi.json -o packages/core/src/client/schema.d.ts
```
The generated file is **committed** (so the repo builds offline). CI runs `npm run gen:check` and
**fails on a diff** (spec drift caught loudly). `ops/` and every shell are untouched by regeneration.
Derive the TERMINAL state sets in `model.ts` from the spec's REAL enums (mined below — `idle`/`archived`
for threads; `completed`/`error`/`archived` for tasks); never reproduce capy-cli's invented vocabulary.
(Hand-narrowing the ~12 used endpoints in `client/schema.ts` is an optional fast-start, but the real
spec is right there — prefer codegen.)

## How to build / test

```bash
bun install                  # Bun is the dev/install fast path (npm also works)
npm run gen                  # generate the typed client from the vendored spec
npm run typecheck            # tsc --noEmit, strict
npm test                     # vitest — ops tested against mockTransport fixtures (zero network)
npm run build                # tsup → ESM JS bins (capy, capy-mcp, capy-mcp-http)
npm run gen:skills           # regenerate skill command tables from OPS; CI fails if committed ≠ generated
```
Tests are network-free: inject `fetch` via `CapyContext`; ops are pure over `ctx`. Transport tests
assert retry/backoff/Retry-After/timeout against a programmable fake. A contract test re-validates the
fixtures against the registry's zod schemas. Surface generators have golden-file snapshots (CLI tree,
MCP tool list, generated tables). Keep one live smoke test gated behind `CAPY_API_KEY` (skipped in CI).

## Conventions

- **Core returns data, never prints.** No `process.argv`/`IS_JSON` global. Output mode is a *shell*
  concern: CLI `render(result, {format})`, MCP `structuredContent`, skills `--json`.
- **Project/org are per-call**, resolved `arg ?? ctx.projectId ?? config ?? env`. Never bake a single
  project into a URL (capy-cli's MCP could drive only one project).
- **Errors:** throw `CapyError` with a string-literal `code`. CLI maps `code`→exit code
  (`unauthorized`→77, `not_found`→69, `rate_limited`→75, `timeout`→124, else 1). MCP maps to
  `{error:{code,message,requestId}}` + `isError`.
- **MCP annotations are derived from `op.effect`** (`read`→readOnly+idempotent, `create`→openWorld,
  `mutate`→idempotent, `destroy`→destructive). Never hand-set them.
- **Secrets:** prefer `CAPY_API_KEY` env / OS keychain; only persist to `~/.capy/config.json` (mode
  0600) on explicit opt-in. Never log the token; the debug seam redacts `Authorization`. Hooks use
  `spawn`+argv (no shell injection) and surface failures as structured warnings — never `catch {}`.
- **Pagination:** every list takes `--cursor`/`--limit` and returns `{items, nextCursor, hasMore}`;
  `listAll()` auto-follows. Don't stop at page 1.
- `body !== undefined` (not `if (body)`) when building requests, so valid falsy bodies are sent.

## Don't

- Don't put logic in a shell, or hand-write a CLI command / MCP tool that duplicates an op.
- Don't add orchestration/judgment opinions — no fleet loop, no `triage` buckets/recommendations, no
  quality gates / `assessReadiness`, no retry-cap `iterate`, no `approve`. capy-kit surfaces faithful
  state + controls; Capy decides how the work is done. Foreground `capy wait` is the only blocker.
- Don't add `gh`/Greptile (or any review re-implementation) to core/SDK/MCP. Just surface what the API
  returns (`prState`, `prNumber`). Richer logic, if ever wanted, belongs in a skill, not the library.
- Don't hardcode model ids or terminal-state enums — fetch models from `/v1/models`; derive enums from
  the spec.
- Don't expand the M1 CLI past the six commands (init, delegate, threads list, threads get, wait,
  status) — ship the smallest genuinely-useful thing first.

## Resolved API facts (from the vendored `spec/capy.openapi.json`)

The design phase flagged several unknowns; the vendored OpenAPI spec answers them with primary data. Use these — do **not** reproduce capy-cli's invented vocabulary.

| Question | Answer (from the spec) |
|---|---|
| Task status enum | `backlog \| queued \| in_progress \| needs_review \| completed \| error \| archived` — note **`error`**, not capy-cli's `failed`. Terminal: `completed`/`error`/`archived`; `needs_review` = stopped, needs a human. |
| Thread status enum | `active \| idle \| archived` (schema `ThreadListItem`). Terminal: `idle`/`archived`. |
| Thread `runState` (finer signal) | `running \| queued \| waiting \| blocked \| ready \| archived` + `waitingOn[]`, `blockedOn[]`, `pendingWakeups` — richer than status; use it for `wait` and faithful observation. |
| Does `Task` expose its parent thread? | **Yes** — `Task.threadId: string\|null`. So you can resolve a task's parent thread directly. |
| Does `/v1/usage` return cost or only credits? | **Currency cost** — `UsageResponse` has `currency`, `totals`, `users[]`, `items[]`, paginated, plus a `routed` enum (`paid\|no_cost\|oss\|external_copilot\|external_codex\|external_byok\|external_azure\|external_unknown\|all`). |
| Create-thread shape | `POST /v1/threads` body = `CreateThreadBody`; response `CreateThreadResponse` carries `status`+`runState` (so a created thread already has a runState — confirm on a live call whether work auto-starts or needs a separate step). |
| Real wire-type names to use | `ThreadListItem`, `Task`, `Message`, `Project`, `UsageResponse`, `CreateThreadBody`/`CreateThreadResponse`, `SendThreadMessageBody`/`SendMessageResponse`, `TaskDiffResponse`, `Setup`, `Snapshots`, `Automation`, `ListThreadsResponse`/`ListThreadsQuery`, `ListModelsResponse`, … (run `npm run gen` to get them all typed). |

Endpoints actually present (31): `/v1/threads` (GET list w/ full filters, POST create), `/v1/threads/{id}` (GET, +`/message` POST, `/messages` GET, `/stop`, `/archive`, `/unarchive`, `/tags`, `/session-token`), `/v1/tasks/{id}` (+`/diff`), `/v1/usage`, `/v1/projects`(+`/{id}`), `/v1/models`, `/v1/sessions/verify`, and project/environment plumbing (`automations`, `browser-snapshots`, `environment-variables/personal`, `setup`, `snapshots`, `warm-pool`, `tags`).

_See `PLAN.md` for milestones, the decision log, and the kickoff procedure._
