# AGENTS.md — capy-kit

This repo is **capy-kit**, a TypeScript toolkit for Capy’s current thread-centric public API. Read this file before working here, then use `README.md` for the user-facing surface, `PLAN.md` for current coverage, and `SPEC.md` for architecture.

## Stay out of Capy’s way

**capy-kit manages Capy; Capy manages the work.** The toolkit maps the API faithfully and provides only mechanical conveniences such as pagination, `wait`, and `delegate`. Do not add fleet loops, triage recommendations, quality gates, retry-cap iteration, approval blocking, or local GitHub/review implementation. Workflow opinion belongs above the core, for example in `capy-fleet-hq`.

## The one rule

Every shell-exposed capability starts as one `Op` in `packages/core/src/ops/`:

```ts
{ name, summary, input: zodSchema, output: zodSchema, effect, run(args, ctx) }
```

Core owns validation and API logic; shells only parse, render, and transport. The CLI explicitly projects registered Ops into its Citty tree and adds only shell concerns (`init`, local project aliases, output, and debugging). MCP and automatic projection are planned, not current fact.

## Current public contract

The vendored official OpenAPI document is `spec/capy.openapi.json`, refreshed from `https://docs.capy.ai/openapi.json` on **2026-08-17**. It has **21 paths and 24 operations**, all under the `https://api.capy.ai/api/v1` base URL. Run:

```bash
npm run gen        # regenerate packages/core/src/client/schema.d.ts
npm run gen:check  # regenerate, then fail if generated output differs
```

The generated type file is committed. Derive every endpoint, field, enum, and error from that spec; do not invent or restore retired capabilities.

The public surface consists of:

- threads and messages, including title controls and queued-message control;
- read-only task trees and transcripts;
- review settings, billing-transfer controls, and review start;
- organization usage.

Project discovery, models, tags, setup, snapshots, environment variables, automations, session tokens, task mutation/diffs, and attachments are app-only. Do not call undocumented replacements.

## Runtime and conventions

- Node **>=18** is the runtime contract; Bun is a development fast path. Binaries build as ESM with `tsup`. Do not casually upgrade Citty, `@clack/prompts`, or Zod.
- `CAPY_API_KEY` is the credential name. `~/.capy/config.json` and `~/.capy/.env` must be mode 0600.
- Thread list/create calls require a known project ID. Keep aliases in local config; the API cannot discover projects.
- Thread creation requires a caller-stable `requestId`; retries can converge. Messages do not have caller idempotency and are not retried automatically.
- Thread lists use `cursor`; message and task lists use `after`. All lists return `{items,cursor}` and a null cursor ends pagination.
- Thread statuses are `active|waiting|pending_user|error|ready_for_review|idle|archived`. Only `active` and `waiting` continue polling.
- Errors are tagged JSON objects; consumers should use HTTP status and `_tag`, never error prose.
- Build request bodies with `body !== undefined`, so valid falsy bodies are preserved. Core returns structured data and never prints or reads `process.argv`.
- Throw `CapyError` with a literal code. The CLI owns error rendering, exit codes, and JSON envelopes. Debug output must redact `Authorization`.

## Build and test

```bash
bun install
npm run gen
npm run typecheck
npm test
npm run build
```

There is no checked-in hosted CI or `gen:skills` script. Do not claim either exists until implemented.

## Don’t

- Don’t put API/business logic in CLI, MCP, skills, or renderers.
- Don’t claim an Op automatically appears in MCP or skills.
- Don’t add orchestration or judgment to faithful surfaces.
- Don’t expose unpublished or retired endpoints.
- Don’t invent endpoint fields, enums, or terminal states; update the vendored spec and generated types together.
