# capy-kit — design spec

> Generated 2026-06-26; revised to an **unopinionated** design. capy-kit is a faithful, typed interface to the Capy API plus skills to **manage Capy and its environment**. It deliberately does **not** orchestrate, gate, or decide *how* coding work gets done — that's Capy's (Captain's) job. See `PLAN.md` for milestones/kickoff, `AGENTS.md` for build conventions.

## Design principle: stay out of Capy's way

The single most important rule for this toolkit: **capy-kit manages Capy; Capy manages the work.**

- It is a clean, typed mapping of the real Capy API (`https://capy.ai/api`, bearer `CAPY_API_KEY`) — every endpoint, faithfully — plus thin, mechanical conveniences (auto-pagination, a poll-until-terminal `wait`, a one-call `delegate` = create thread + first message).
- It does **not** impose an orchestration model: no fleet loops, no triage buckets / recommendations, no local "quality gates" (`pr_exists`/`ci`/`tests` readiness), no retry-cap "iterate" policy, no `approve`-blocking, no GitHub/Greptile review re-implementation. Those were the prior-art tool's opinions; we drop them.
- You get quality the Capy-native way: tell Capy **what** to do and **the bar to hit** (e.g. "don't come back until CI is green and review is clean") in the delegation prompt, and let **Captain** plan, spawn tasks, run tests, review, and iterate on its own. capy-kit gives you faithful visibility (real `status`/`runState`, diffs, messages, usage) and faithful controls (message, stop, archive) — and gets out of the way.
- Where the prior art shelled `gh`/Greptile and reconciled PR state itself, capy-kit just surfaces what the API returns (`prState`, `prNumber`, …). If you want richer PR/CI logic, do it in a *skill* or your own agent — not baked into the library.

What we DO keep from the prior art (`yazcaleb/capy-cli`, clean-room — ideas, not code): the robustness and DX patterns that aren't opinions about your workflow (typed transport with retry/`Retry-After`, a typed error envelope, JSON-first output, pagination, clickable thread URLs, a deep skill manual with object model + guardrails, AGENTS.md as a runbook). And one structural idea — the operation registry — purely to keep the four surfaces in sync.

> [!note] Spec is vendored
> The Capy OpenAPI 3.1 spec is at `https://docs.capy.ai/openapi.json` and **vendored at `spec/capy.openapi.json`** (31 endpoints, fetched 2026-06-26). The typed client is generated from it (`npm run gen`) — don't hand-write `any` types or invent endpoints.

## Resolved API facts (from the vendored spec)

| Question | Answer |
|---|---|
| Task status enum | `backlog \| queued \| in_progress \| needs_review \| completed \| error \| archived` (it's **`error`**, not `failed`). |
| Thread status / runState | status `active \| idle \| archived`; richer `runState` `running \| queued \| waiting \| blocked \| ready \| archived` (+ `waitingOn[]`, `blockedOn[]`, `pendingWakeups`). |
| Does `Task` expose its parent thread? | **Yes** — `Task.threadId: string\|null`. |
| Does `/v1/usage` return cost? | **Yes** — `UsageResponse` has `currency`, `totals`, `users[]`, `items[]` (paginated) + a `routed` enum (`paid\|no_cost\|oss\|external_*\|all`). |
| Create-thread shape | `POST /v1/threads` body `CreateThreadBody` → `CreateThreadResponse` (carries `status`+`runState`). |
| Real wire-type names | `ThreadListItem`, `Task`, `Message`, `Project`, `UsageResponse`, `CreateThreadBody`/`CreateThreadResponse`, `SendThreadMessageBody`/`SendMessageResponse`, `TaskDiffResponse`, `Setup`, `Snapshots`, `Automation`, … (run `npm run gen` for the full typed set). |

There is **no `approve` and no quality-gate endpoint** in the API — that confirms the unopinionated direction. Merging happens natively in Capy/GitHub.

---

## Architecture

### One core, four surfaces — kept in sync by an operation registry

Every capability is an `Op`, declared **once** in `packages/core/src/ops/`. The SDK exports them; the CLI command tree, the MCP tool roster, and the skill command tables are all *projections* of the same registry. Add one op → it appears everywhere; nothing drifts. This is the only "opinion," and it's purely about internal consistency, not about your workflow.

```ts
// packages/core/src/ops/define.ts
export interface Op<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;        // canonical resource.verb — "threads.list", "delegate", "setup.update"
  summary: string;     // one-line: CLI help / MCP description / skill table row
  description?: string;
  input: I;            // zod — the single source of CLI flags, MCP inputSchema, validation
  output: O;           // zod — typed result + MCP outputSchema
  effect: "read" | "create" | "mutate" | "destroy";  // → retry policy + MCP annotations
  run(args: z.infer<I>, ctx: CapyContext): Promise<z.infer<O>>;  // returns DATA, never prints
}
export const OPS: Op<any, any>[] = [ /* every op */ ];
```

Generators project `OPS`: `cli/build.ts` (each op → a Citty command; a `zodToArgs()` shim turns `op.input` into flags), `mcp/build.ts` (each op → `server.registerTool(name, {description, inputSchema: op.input.shape, outputSchema: op.output.shape, annotations: annotationsFor(op.effect)}, …)`), `scripts/gen-skills.ts` (op tables embedded in each `SKILL.md`, CI-checked for drift).

**No business logic in any shell.** A CLI command is `render(await op.run(args, ctx), fmt)`; an MCP handler is `toMcpResult(await op.run(args, ctx))`; a skill runs `capy <verb> --json` and reads the JSON. **Core returns data, never prints** — no `process.argv`/`IS_JSON` global; output mode is a shell concern. This keeps core unit-testable with an injected `fetch` and trivially MCP-portable.

### Two-layer core

```
@capy-kit/core
├── client/
│   ├── schema.d.ts          # GENERATED by openapi-typescript from spec/capy.openapi.json
│   ├── transport.ts         # fetch wrapper: auth, idempotency-aware retry honoring Retry-After,
│   │                        #   AbortSignal timeout, {error}→CapyError, onRequest/onResponse
│   │                        #   (redacts Authorization), optional zod boundary validation
│   ├── context.ts           # CapyContext + resolveContext (defaults < config < .env < env)
│   ├── errors.ts            # CapyError + CapyErrorCode string-literal union + PERMANENT set
│   └── resources.ts         # 1:1 typed methods for EVERY endpoint (faithful)
├── model.ts                 # enums/helpers derived from the spec: TERMINAL_THREAD/TERMINAL_TASK, isThreadId
├── ops/
│   ├── define.ts            # Op<>, OPS
│   ├── threads.ts tasks.ts  # faithful resource ops (list+listAll, get, message, messages, stop, archive, tags, diff)
│   ├── delegate.ts          # convenience: create Captain thread (+optional first message) → {threadId, url}
│   ├── poll.ts              # pollUntilTerminal() generator + thin `wait` op (terminal sets from model.ts)
│   ├── usage.ts             # usage/cost over /v1/usage
│   ├── projects.ts models.ts
│   └── env/                 # ENVIRONMENT management: setup, envVars, warmPool, snapshots, browserSnapshots, automations, tags
└── render/index.ts          # Renderer (human table/section vs json) — INJECTED, never argv-read
```

### Repo layout (npm/Bun workspaces)

```
capy-kit/
├── spec/capy.openapi.json   # vendored Capy OpenAPI 3.1 (PRESENT)
├── packages/core/           # @capy-kit/core  — the SSOT
├── packages/cli/            # @capy-kit/cli   — bin "capy"
├── packages/mcp/            # @capy-kit/mcp   — bins "capy-mcp" (stdio) + "capy-mcp-http"
├── scripts/gen-skills.ts    # regenerate skill tables from OPS
└── skills/                  # skill packages (symlinkable into ~/.claude or .agents/skills/)
```

---

## Library surface (`@capy-kit/core`)

All ops take `CapyContext`, return structured data, never print. Project/org are per-call (defaulting to context) so one client/server drives many projects.

```ts
type CapyContext = {
  apiKey: string;
  baseUrl?: string;       // default 'https://capy.ai/api'  (version /v1/... lives in the path)
  projectId?: string;     // default for thread/task/env ops; per-call override wins
  orgId?: string;         // required by usage()
  fetch?: typeof fetch;   // injectable for tests / MCP
  validate?: boolean;     // safeParse responses at the boundary (default false; on in tests/CI)
  timeoutMs?: number;     // default 60_000 via AbortSignal
  onRequest?(r: Request): void;
  onResponse?(r: Response): void;   // debug seam; redacts Authorization
};
function resolveContext(p?: Partial<CapyContext>): CapyContext;  // DEFAULTS < ~/.capy/config.json < ~/.capy/.env < process.env (CAPY_*)

type CapyErrorCode =
  | 'no_api_key' | 'network_error' | 'bad_response' | 'timeout'
  | 'not_found' | 'unauthorized' | 'forbidden' | 'rate_limited'
  | 'no_project' | 'validation_error' | 'api_error';
class CapyError extends Error { readonly code: CapyErrorCode; readonly status?: number; readonly retryAfterMs?: number; readonly requestId?: string }
```

### Faithful resource methods (1:1 with the 31 endpoints)

```ts
// Work
client.threads.list({ projectId, status?, branch?, prNumber?, prState?, authorEmail?, origin?, tag?, q?, cursor?, limit? }): Promise<Page<ThreadListItem>>
client.threads.listAll(filters): AsyncIterable<ThreadListItem>     // auto-follows nextCursor
client.threads.get(id) / create(body) / stop(id,{reason?}) / archive(id) / unarchive(id)
client.threads.message(id, { text, model?, attachmentUrls? })       // steer a running thread
client.threads.messages(id, { limit?, cursor? })                    // conversation history
client.threads.tags.set(id, tags[])  /  sessionToken(id)
client.tasks.get(id) / diff(id, { mode? })
// Observe
client.usage.get({ orgId, from, to })            // currency cost, totals, per-user, per-item, routed
client.projects.list() / get(id)
client.models.list()
client.sessions.verify(body)
// Environment (the "manage Capy's environment" surface)
client.env.setup.get(projectId) / update(projectId, body)          // dev-env: vmSize, phases, commands, hooks
client.env.vars.list(projectId) / set(projectId, kv) / delete(projectId, name)
client.env.warmPool.get(projectId) / update(p, body) / clear(p) / instances(p) / test(p, body)
client.env.snapshots.get(projectId) / update(projectId, body)
client.env.browserSnapshots.list/get/create/update/delete(projectId, …)
client.env.automations.list/get/create/update/delete(projectId, …) / trigger(projectId, id, payload)
client.projects.tags.list(projectId) / create(projectId, body)
```

### Thin conveniences (mechanical, not opinionated)

```ts
import { ops } from '@capy-kit/core';

ops.delegate(ctx, { prompt, model?, repos?, branch?, tags?, attachmentUrls?, projectId? }): Promise<DelegateResult>
//   POST /v1/threads (+ first /message if the API needs it) → { threadId, status, runState, model, url }
//   Hands the goal to Capy. Does NOT decide how Capy executes it.

ops.pollUntilTerminal(ctx, { id, kind?, intervalMs?, timeoutMs?, signal? }): AsyncGenerator<PollTick, TerminalResult>
ops.wait(ctx, { id, timeoutMs?, intervalMs? }): Promise<{ status, runState, terminal, lastStatus }>
//   Pure poll until a terminal state from model.ts. Aborts fast on a PERMANENT CapyError. No retry/iterate policy.

ops.usage(ctx, { orgId?, from, to, groupBy? }): Promise<UsageReport>
```

That's the whole composite layer: `delegate`, `wait`/`pollUntilTerminal`, `usage`. **No `triage`, `assessReadiness`/gates, `iterate`, `approve`, or review providers** — by design.

---

## CLI surface (`capy`)

Citty, noun-then-verb, every command a projection of an `Op`. Globals on all: `--json`, `--project <id>`, `--org <id>`, `--profile <name>`, `--debug`.

```
capy
├─ init                               # @clack/prompts wizard → ~/.capy/config.json (0600)
├─ config <get|set> [key] [value]
│
├─ delegate "<prompt>"               # create a Captain thread; print clickable url. alias: do
│     --model <id> | --opus | --sonnet | --haiku   --repo <owner/name@branch> (repeatable)
│     --tag <t> (repeatable)  --attach <url>  --wait [--timeout <s>]
├─ wait <id>                          # poll until terminal. --timeout --interval (exit 1 + {lastStatus} on timeout)
│
├─ threads
│   ├─ list [status]                  # FULL filters: --branch --pr --pr-state --author --origin --tag -q --limit --cursor --all
│   ├─ get <id>   ├─ messages <id>   ├─ message <id> "<text>" [--model]   # steer
│   ├─ stop <id> [--reason]  ├─ archive <id>  ├─ unarchive <id>  ├─ tags <id> <t...>
├─ tasks <get|diff> <id>
│
├─ usage                              # cost. --org --from --to --by <user|item>. alias: cost
├─ status                             # plain dashboard: your threads/tasks with real status + runState (no buckets/recs)
│
├─ projects <list|get [id]>
├─ models                            # list + refresh the alias cache
├─ env                                # MANAGE THE ENVIRONMENT
│   ├─ setup <get|update>            # dev-environment: vmSize, init/checkout/startup phases, commands, hooks
│   ├─ vars <list|set|unset>         # project secrets / env vars
│   ├─ pool <get|set|instances|test|clear>   # warm pool VMs
│   ├─ snapshots <get|update>
│   ├─ browser-snapshots <list|get|create|update|delete>
│   └─ automations <list|get|create|update|delete|trigger>
│
└─ commands [--json]                 # self-documenting catalog dumped from OPS (seeds skill gen)
```

Conventions: `--json` everywhere (default human); uniform pagination (`--limit`/`--cursor` in, `{items,nextCursor,hasMore}` out, `--all` follows); errors render `{error:{code,message,requestId}}` (json) or `capy: <message>` (stderr); exit codes mapped from `CapyError.code` (`unauthorized`→77, `not_found`→69, `rate_limited`→75, `timeout`→124, else 1). `--profile` selects a named config block for multi-project/multi-org.

> `status` is a faithful list, not a triage engine — it shows each thread's real `status`/`runState`/`waitingOn`/`blockedOn` and lets you (or a skill, or Capy) decide. No "stuck/ready/needs_pr" buckets, no recommendations.

---

## MCP surface (`capy-mcp`)

`createCapyServer(ctx?): McpServer` — a factory (no import-time singleton). Two bins: `capy-mcp` (`StdioServerTransport`, the Claude Code path) and `capy-mcp-http` (`StreamableHTTPServerTransport`). Tools are auto-registered by looping `OPS`:

```ts
for (const op of OPS) {
  server.registerTool(op.name.replace(/\./g, "_"), {
    description: op.description ?? op.summary,
    inputSchema: op.input.shape,
    outputSchema: op.output.shape,
    annotations: annotationsFor(op.effect),   // read→readOnly+idempotent, create→openWorld, mutate→idempotent, destroy→destructive
  }, async (args) => { try { return toMcpResult(await op.run(args, ctx)); } catch (e) { return toMcpError(e); } });
}
```

So the tool roster IS the faithful op set: `capy_threads_list/get/create/message/messages/stop/archive/unarchive/tags`, `capy_tasks_get/diff`, `capy_delegate`, `capy_wait`, `capy_usage`, `capy_projects_*`, `capy_models_list`, and the environment tools `capy_env_setup_*`, `capy_env_vars_*`, `capy_env_pool_*`, `capy_env_snapshots_*`, `capy_env_browser_snapshots_*`, `capy_env_automations_*`. Every tool accepts an optional `projectId`/`orgId`. No `capy_triage`/`capy_review`/`capy_approve`/`capy_iterate` tools — an agent using the MCP server reads real state and decides for itself, or just delegates and lets Capy run.

Result shape (every tool): `{ structuredContent: data, content:[{type:'text',text:JSON.stringify(data)}] }`; errors `{ isError:true, content:[…{error:{code,message,requestId}}] }`. (Streamable-HTTP remote auth is a pre-remote-use task; stdio is the v1 path.)

---

## Skills (manage Capy + its environment — no orchestration opinion)

Two-tier packaging per skill: a thin discoverable **card** (`SKILL.md` frontmatter with trigger keywords + `allowed-tools: Bash(capy:*)` + a generated command table) and a deep loadable **manual** (object model, real status/runState semantics, faithful command reference with output shapes, prompting tips). Tables are generated from `capy commands --json` (CI-checked). Skills call the CLI's `--json` contract — they never reimplement API logic, and they don't impose a fleet/gate loop.

The four shipped skills:

1. **`capy-delegate`** — hand work to Capy and let Capy run it. Teaches the object model + the delegation discipline (tell Capy **what** + the **quality bar**, not **how**; link the issue), then `capy delegate "<prompt>" --repo … --json` → capture the url → optionally `capy wait`. The point: Captain plans, spawns tasks, tests, reviews, and iterates *on its own* — the skill does not gate or retry on Capy's behalf.
2. **`capy-work`** — observe & steer in-flight work, faithfully. `capy threads list`/`get`, `capy threads messages` to read, `capy threads message` to steer ("focus on X", "also update the tests"), `capy tasks diff` to inspect, `capy threads stop`/`archive`. Explains the real `status`/`runState`/`waitingOn` so the agent decides — no buckets, no recommendations engine.
3. **`capy-env`** — manage a project's environment & config: the dev-environment **setup** (vmSize, init/checkout/startup phases, commands, hooks), **env vars/secrets**, **warm pool** VMs, **snapshots**, **automations**, and **models**. This is the "manage Capy's environment" core.
4. **`capy-usage`** — read spend: `capy usage --org … --from … --to … --json`, summarized per user/item, with the `routed` breakdown.

`AGENTS.md` (the consumer install runbook, generated here) steers the key to `CAPY_API_KEY` env / OS keychain (config 0600 only on opt-in), auto-fetches the default `projectId` via `capy projects list --json`, and its tool/command counts are generated (can't drift).

---

## Auth & config

- **`CAPY_API_KEY`** (Bearer) — the only required secret. Read at context construction; never logged (debug seam redacts `Authorization`).
- **`CAPY_PROJECT_ID`** — default project; any op takes a per-call `projectId` that wins. **`CAPY_ORG_ID`** — needed only by `usage`. **`CAPY_BASE_URL`** — default `https://capy.ai/api` (version in the path).
- **Precedence:** `DEFAULTS < ~/.capy/config.json < ~/.capy/.env < process.env (CAPY_*)`. `--profile <name>` selects a named block (multi-project/multi-org).
- **Config** `~/.capy/config.json` (mode 0600): `baseUrl`, `projectId`, `orgId`, `defaultModel` (default `claude-opus-4-8`), `models` (alias cache from `GET /v1/models` — not hardcoded), `profiles`. No `quality` block (we don't gate).
- **Security:** prefer env/keychain over plaintext; secrets only persisted on explicit opt-in; any hooks use `spawn`+argv (no shell injection) and surface failures as warnings.

---

## Borrow vs. cut (vs. `yazcaleb/capy-cli`, clean-room)

**Borrow (robustness/DX, not workflow opinions):** one shared core reused by every surface; two-layer transport (pure transport + ambient-config wrapper); idempotency-aware retry honoring `Retry-After` + AbortSignal timeout; single typed `CapyError` + `{error:{code,message}}` envelope; JSON-first dual-mode output; non-zero exit on error/timeout; `pollUntilTerminal` with permanent-vs-transient classification; clickable thread URLs on create; config 0600; lazy dynamic imports; two-tier skill packaging + AGENTS.md runbook + the object-model/guardrails manual style; `resolveModel` alias→id from `/v1/models`.

**Do better:** generate the client from the vendored OpenAPI 3.1 (capy-cli was hand-written `any`); trust the real **thread-centric** API; no `process.argv` global; `createCapyServer(ctx)` factory + stdio AND HTTP; project/org per-call (capy-cli was single-project locked); full `/v1/threads` filter set + auto-pagination; a real **usage/cost** surface; full **environment** management (setup/pool/snapshots/automations); models from `/v1/models`; ESM JS bins (Node ≥18, no Bun-on-PATH requirement); `body !== undefined`; generate skill/AGENTS tables (CI drift check).

**Deliberately cut as too opinionated (the whole point of this revision):** the quality-gates / readiness model (`pr_exists`/`pr_open`/`ci`/`tests`), the `triage` bucket+recommendation engine, the retry-capped `iterate`, the `approve` gate (no API approve exists anyway), the GitHub/Greptile `ReviewProvider` adapters, and any fleet/background-watcher loop. **capy-kit surfaces faithful state and faithful controls; Capy decides how the work is done.**

---

## Examples

### 1. Delegate and let Capy run it (CLI)
```bash
$ capy delegate "Implement ENG-123 user-migration backfill; link the Linear issue; \
    don't come back until tests pass and CI is green" \
    --repo owner/repo@main --opus --tag eng-123 --wait --timeout 1200
delegating… thread thr_9c1f (claude-opus-4-8)
https://capy.ai/project/prj_abc/captain/thr_9c1f
waiting… runState=ready  status=idle  (4m12s)
# Capy planned, coded, tested, reviewed, and opened a PR on its own. Inspect it:
$ capy tasks diff $(capy threads get thr_9c1f --json | jq -r '.tasks[0].identifier') --json
```

### 2. Observe & steer faithfully (CLI)
```bash
$ capy threads list active --json | jq '.items[] | {id, runState, waitingOn}'
$ capy threads message thr_9c1f "also add a rollback path and a changeset" --json   # steer; Capy decides how
```

### 3. Manage the environment (CLI)
```bash
$ capy env setup get --json                            # current dev-env (vmSize, phases, hooks)
$ capy env setup update --vm medium --init "pnpm install" --init "pnpm db:migrate" --json
$ capy env vars set DATABASE_URL=postgres://… --json   # project secret, injected into task VMs
$ capy env pool set --target 3 --json                  # keep 3 warm VMs for instant starts
$ capy env automations create --cron "0 9 * * 1-5" --prompt "triage failing tests, open fixes" --json
```

### 4. MCP tool calls (what an agent emits)
```jsonc
{ "name": "capy_delegate", "arguments": { "prompt": "Fix the flaky migration test in central",
    "projectId": "prj_abc", "repos": ["owner/repo@main"], "model": "claude-opus-4-8" } }
// → structuredContent: { "threadId":"thr_9c1f2a", "status":"active", "runState":"running",
//                        "url":"https://capy.ai/project/prj_abc/captain/thr_9c1f2a" }
{ "name": "capy_env_pool_set", "arguments": { "projectId":"prj_abc", "targetSize": 3 } }
{ "name": "capy_wait", "arguments": { "id":"thr_9c1f2a", "timeoutSec": 900 } }
// → { "status":"idle", "runState":"ready", "terminal": true, "lastStatus":"running" }
```

### 5. SDK (an agent driving core directly)
```ts
import { resolveContext, ops } from '@capy-kit/core';
const ctx = resolveContext();
const { threadId, url } = await ops.delegate(ctx, {
  prompt: 'Refactor the notifications webhook handler; keep behavior identical; ensure tests pass and review is clean',
  repos: ['owner/repo@main'], model: 'claude-opus-4-8',
});
console.error('watch it:', url);                                  // stderr — never pollute JSON
const final = await ops.wait(ctx, { id: threadId, timeoutMs: 900_000 });  // just wait; Capy did the work
const cost  = await ops.usage(ctx, { from: '2026-06-01', to: '2026-06-26', groupBy: 'item' });
```

### 6. Skill invocation (Claude Code)
```
> /capy-delegate hand the central flaky-test fix to capy, tell it the bar is green CI, and watch it
> /capy-env bump the dev VM to medium and add pnpm db:migrate to the setup
```
The skills call the CLI's `--json` contract and let Capy run the actual work.
