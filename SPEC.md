# capy-kit — legacy target design specification

> Historical reference. The current Capy API migration supersedes the legacy contract described below.

> **Architecture target, not an as-built inventory.** This document describes the intended end
> state. The SDK/core and 11-op CLI are implemented; MCP and automatic cross-surface generation are
> planned. See `README.md` and `PLAN.md` for current truth.

capy-kit is a faithful, typed interface to the Capy API plus small mechanical conveniences. It
deliberately does not orchestrate, gate, or decide how coding work is done.

## Design principle

**capy-kit manages Capy; Capy manages the work.**

- Map the official thread-centric API faithfully.
- Add only mechanical conveniences: typed transport, validation, pagination, `delegate`, `wait`,
  rendering, and transport adapters.
- Tell Captain the goal and quality bar in the prompt; do not recreate Captain's planning,
  testing, review, or iteration locally.
- Do not add triage buckets, readiness gates, retry caps, approval blocking, or GitHub/review-provider
  reconciliation to core, CLI, or MCP.
- Keep optional workflow opinion in a higher-level consumer such as `capy-fleet-hq`.

The prior `capy-cli` may inform robustness and DX, but its task-centric API and workflow model are
not authoritative and its code must not be copied.

## Current and target state

| Surface | Current | Target |
|---|---|---|
| `@capy-kit/core` | Transport, generated types, thread/project/model resources, 11 Ops | Faithful coverage of the official 37 operations plus thin helpers |
| `capy` CLI | Built and used; explicit Citty tree over registered Ops | Mechanical projection of the full supported Op roster |
| `capy-mcp` | Private package manifest and empty source placeholder | Server factory plus stdio; HTTP only with an explicit auth design |
| Skills | Manual `capy` and `capy-fleet-hq` skills | Keep manuals curated; optionally generate reference tables from `OPS` |
| Codegen/CI | OpenAPI generation scripts; no hosted workflow | Drift checks in CI and generated projections where they reduce drift |

“Declared once” means business logic is declared once in core. It does not mean all four surfaces
already materialize automatically.

## Official API source

The OpenAPI 3.1 document is vendored at `spec/capy.openapi.json` from
`https://docs.capy.ai/openapi.json`. The **2026-07-10** snapshot has **26 paths and 37 operations**.
`npm run gen` produces the committed `packages/core/src/client/schema.d.ts`; `npm run gen:check`
regenerates and checks for a diff.

Important wire facts:

- Task status is `backlog|queued|in_progress|needs_review|completed|error|archived` and
  `Task.threadId` exists.
- Thread status is `active|idle|archived`. The finer `runState` is
  `running|stopping|queued|waiting|blocked|ready|archived`, with `waitingOn`, `blockedOn`, and
  `pendingWakeups`.
- `runState` is authoritative for deciding whether idle work is still progressing. A live thread has
  been observed as `status=idle` while `runState=waiting` on review, so `idle` alone must never mean
  done or ready to land. Archived status is the defensive exception: live data can retain a stale
  non-archived runState after the thread has already been archived.
- Thread-list origin includes `github`.
- Sending a message supports `mode: interrupt|queue` and a caller `messageId`; responses can be
  `sent|queued|pending` and may include append/deduplication metadata.
- Usage includes currency totals and routed breakdowns, including `external_xai`.
- `GET /v1/models` returns `id`, `name`, `provider`, and `captainEligible`. It does not define
  capy-kit aliases or a default model.
- Automations support versioned, multiple triggers. The implementation must not reduce that schema
  to a single cron/webhook abstraction.

The public snapshot no longer lists the six warm-pool operations present in the older document.
capy-kit treats them as de-publicized and unsupported. Their absence does not prove that the server
routes were deleted.

## One core, projected surfaces

Every supported shell capability begins as one `Op`:

```ts
interface Op<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;                     // e.g. "threads.list"
  summary: string;
  description?: string;
  input: I;
  output: O;
  effect: "read" | "create" | "mutate" | "destroy";
  run(args: z.infer<I>, ctx: CapyContext): Promise<z.infer<O>>;
}
```

Core returns data and never prints. A shell may parse flags, select output format, stream progress,
or adapt a result to another protocol, but it must call the Op rather than reimplement it.

The current CLI uses a reusable `opCommand()` adapter for ordinary leaf commands while explicitly
wiring the command tree. The target MCP server will iterate `OPS`, and a future skill generator may
derive reference tables. Those two generators do not exist yet.

### Core layers

```text
@capy-kit/core
├── client/schema.d.ts     generated OpenAPI wire types
├── client/transport.ts    auth, retry/Retry-After, timeout, errors, debug hooks
├── client/resources.ts    typed endpoint wrappers
├── client/schemas.ts      Zod mirrors for implemented response shapes
├── ops/                   registry and business logic
├── model.ts               enums, aliases, wait-state helpers, URL helper
└── render/                human/JSON rendering, independent of argv
```

`CapyContext` is injectable and per call:

```ts
type CapyContext = {
  apiKey: string;
  baseUrl: string;
  webBaseUrl: string;
  projectId?: string;
  orgId?: string;
  authorEmail?: string;
  fetch: typeof fetch;
  validate: boolean;
  timeoutMs: number;
  maxRetries: number;
  defaultModel: string;
  defaultReasoning?: string;
  defaultBuildModel?: string;
  defaultBuildReasoning?: string;
  onRequest?(request: Request): void;
  onResponse?(response: Response): void;
};
```

Ordinary precedence is defaults, config file, `~/.capy/.env`, process environment, then explicit
input. Project identity has a fail-closed profile exception: explicit `--project` wins; otherwise an
explicit profile's effective file configuration (profile over top-level) supplies the project and
both process/dotenv `CAPY_PROJECT_ID` are ignored. Without a profile, the ordinary order applies.
Missing requested profiles and malformed/unreadable config are validation errors; only a genuinely
missing file is absent.

## As-built core and CLI

The registered Ops are:

```text
delegate
threads.list  threads.get  threads.stop  threads.message  threads.messages
wait          status
projects.list projects.get
models.list
```

The CLI tree is:

```text
capy init
capy delegate <prompt> [--wait]
capy wait <threadId>
capy threads list|get|stop|message|messages
capy status
capy projects list|get
capy models list
```

Every Op command supports `--json`, `--project`, `--org`, `--profile`, and `--debug` as applicable.
`init` is CLI-only because local configuration is a shell concern, not an API operation.

Current convenience contracts:

- `delegate` calls `POST /v1/threads`, which creates and starts work, and returns a clickable thread
  URL. Human output includes the returned project id, and a response-project mismatch fails closed.
  Captain and builder model/reasoning settings are independently optional, can use the local
  `default*` settings, and accept a full model id or capy-kit's static `opus|sonnet|haiku` aliases.
- `threads.message` steers the existing Captain context. It exposes queue/interrupt delivery,
  caller deduplication ids, model/reasoning overrides, attachments, and impersonation. When context
  selects a project, it preflights thread identity and refuses a cross-project mutation.
- `threads.stop` requests that Capy stop a running thread without archiving or judging its output;
  it uses the same selected-project preflight.
- `threads.messages` normalizes history to oldest-to-newest and `--all` follows all pages.
- `status` defaults to active threads, optionally defaults to `CAPY_AUTHOR_EMAIL`, and returns every
  PR in `pullRequests` plus a compatibility `pr` convenience.
- `wait` continues for `running|stopping|queued|waiting` unless status is archived, proves success
  only for non-archived `ready`, and settles nonterminal for blocked or archived state. CLI exits are
  0 done, 123 blocked, 124 timeout, and 125 archived.
- `delegate --wait --json` retains delegate fields at the root and adds a `wait` field.
- `models.list` reports live availability and Captain eligibility. `init` uses it and `projects.list`
  to populate separate Captain/builder default-model and name-first project pickers while retaining
  explicit offline fallbacks; builder eligibility remains API-validated because it is not supplied
  by model discovery. The live project picker stores a verified canonical id and never guesses an
  ambiguous name. Offline mode stores a caller-asserted id because no identity lookup is available.

## Planned API parity

The target resource/Op surface covers all official operations, grouped as follows:

- Threads: remaining archive/unarchive controls, tags, and session token.
- Tasks: get and diff.
- Projects: discovery and project tag list/create.
- Usage and session verification.
- Environment: setup, snapshots, browser snapshots, and personal environment variables.
- Automations: list/get/create/update/delete/trigger with versioned multi-trigger schemas.

The target does not include warm-pool while it remains outside the public specification.

Planned composite helpers should remain mechanical. Examples are `listAll` pagination, the existing
one-call `delegate`, and `pollUntilTerminal`. There is no planned `triage`, `assessReadiness`,
`iterate`, `approve`, or review-provider layer.

## Planned MCP surface

The intended MCP implementation is a factory with no import-time singleton. It registers tools by
iterating `OPS`, converts Zod shapes to schemas, derives annotations from `op.effect`, and returns
structured data or the standard error envelope. Stdio is the first usable transport. A
streamable-HTTP binary must not be treated as production-ready until authentication and per-session
context are designed.

The package currently has no MCP source implementation or declared binaries. Its private manifest
and empty source placeholder are scaffolding, not evidence that tools are available.

## Skills

Two skills exist today:

- `capy`: faithful delegation, observation, waiting, and steering through `capy --json`.
- `capy-fleet-hq`: an opinionated local-HQ/fleet workflow layered above the faithful CLI.

They are curated manuals. There are no generated command tables and no `gen-skills` script today.
If reference generation is added, it should derive only mechanical command metadata from `OPS` and
preserve human-authored workflow guidance.

## Errors, security, and transport

- All requests use bearer `CAPY_API_KEY`; debug output must redact `Authorization`.
- Prefer environment/keychain storage. `~/.capy/config.json` and `~/.capy/.env` must both be mode
  0600; context loading refuses group/other-readable files, and plaintext persistence requires
  explicit opt-in.
- `capy init` pins live discovery with a newly entered key to the canonical Capy API instead of
  honoring an ambient/configured API base URL.
- Human renderers and CLI errors strip terminal escape/control sequences from upstream text; JSON
  retains the structured data through normal JSON escaping.
- Transport retries only when appropriate, honors `Retry-After`, and uses abortable timeouts.
- API and validation failures become `CapyError` with a stable string code and optional request id.
- JSON shells emit `{error:{code,message,requestId?}}`; human output goes to stderr.
- Request bodies are included when `body !== undefined`, so valid falsy payloads survive.
- Lists retain `{items,nextCursor,hasMore}` and explicit all-page helpers.

## Current examples

```bash
capy projects list --json

capy delegate 'Implement ENG-123; preserve behavior; return with tests and CI green' \
  --repos owner/repo@main --wait --timeoutSec 1200 --json

capy status --json
capy threads messages <threadId> --all --json
capy threads message <threadId> 'also add rollback coverage' \
  --mode queue --messageId eng-123-rollback --json

capy wait <threadId> --timeoutSec 900 --json
```

```ts
import { ops, resolveContext } from "@capy-kit/core";

const ctx = resolveContext();
const delegated = await ops.delegate(ctx, {
  prompt: "Fix the flaky migration test and keep CI green",
  repos: ["owner/repo@main"],
});
const final = await ops.wait(ctx, { id: delegated.threadId });
```

## Explicitly out of scope

- Fleet loops or background watchers in core.
- Locally invented readiness/quality gates.
- Retry-capped “iterate until good” policy.
- Approval or merge blocking.
- GitHub, Greptile, or other review-provider reimplementations.
- Hardcoded claims that `/v1/models` supplies aliases/defaults.
- Undocumented/private endpoints, including warm-pool while absent from the official spec.
