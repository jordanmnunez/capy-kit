# capy-kit

A TypeScript toolkit for the [Capy](https://capy.ai) API. The shared core owns each implemented
capability as one typed `Op`; the CLI is a thin shell over those Ops.

**capy-kit manages Capy; Capy manages the work.** The faithful core/CLI do not add fleet loops,
triage, or quality gates. Give Captain the goal and quality bar, then observe or steer the real
thread. The optional `capy-fleet-hq` skill is where higher-level fleet opinion lives.

## What works today

- **`@capy-kit/core`** — typed transport, generated wire types, resources, rendering, and 11 Ops.
- **`capy`** — built CLI: `init`, `delegate`, `wait`, `threads list|get|stop|message|messages`, `status`,
  `projects list|get`, and `models list`.
- **`capy` skill** — faithful delegation/observation/steering manual.
- **`capy-fleet-hq` skill** — opinionated routing, sizing, dispatch, and fleet overview above the CLI.

The MCP package is only a scaffold. Automatic MCP registration and generated skill tables are
target architecture, not current functionality, and MCP has not been selected as the next priority.

## Use it

```bash
capy projects list --json
capy models list --json

capy delegate 'Implement ENG-123; preserve behavior; return with tests and CI green' \
  --repos your-org/your-repo@main \
  --model gpt-5.6-terra --reasoning max \
  --buildModel gpt-5.6-terra --buildReasoning max \
  --wait --timeoutSec 1200 --json

capy status --json
capy threads messages <threadId> --all --json
capy threads message <threadId> 'also cover rollback behavior' \
  --mode queue --messageId eng-123-rollback --json
capy wait <threadId> --timeoutSec 900 --json
```

Every Op command supports `--json` and redacted `--debug` request/response metadata logging. Human
delegation output echoes the selected project id, and a mismatched create response fails instead of
appearing to dispatch safely.

Project selection fails closed:

- `capy init` discovers all visible projects, displays recognizable names with task code/repos/id,
  and stores the selected canonical id. It never guesses the first or an ambiguous name. If
  discovery is unavailable, it visibly falls back to a caller-asserted canonical-id prompt; offline
  ids cannot be verified by capy-kit. Discovery with the newly entered key always targets the
  canonical `https://capy.ai/api`, ignoring ambient/configured `CAPY_BASE_URL` overrides.
- Explicit `--project <id>` has highest precedence.
- Explicit `--profile <name>` must exist. Without `--project`, its effective file-configured project
  (profile over top-level) is authoritative and ambient `CAPY_PROJECT_ID` values are ignored.
- Without a profile, project precedence remains process environment, `~/.capy/.env`, then top-level
  config. Malformed/unreadable configuration is an error; only a missing file is treated as absent.
- When a project is selected, `threads message` and `threads stop` preflight the thread and refuse a
  cross-project mutation. SDK callers with no project context may still use a globally unique id.

`status` defaults to **active** threads. When `CAPY_AUTHOR_EMAIL` is configured it defaults to that
author on shared projects, and it returns **every PR** in `pullRequests` (`pr` remains a first-PR
convenience). Do not infer completion from `status=idle`: a thread can be idle while
`runState=waiting` on review. `wait` treats only non-archived `ready` as proven done; `blocked` and
archived status/runState settle without proving success, while `running|stopping|queued|waiting` are
still progressing unless the coarse status has already become archived.

Wait exit codes are 0 for done, 123 for blocked, 124 for timeout, and 125 for archived/stopped with
outcome unknown. Under `delegate --wait --json`, delegate fields stay at the root and the final poll
result is added as `wait`.

## Install from source

```bash
git clone https://github.com/jordanmnunez/capy-kit
cd capy-kit
bun install
npm run build

mkdir -p ~/.local/bin
ln -s "$PWD/packages/cli/dist/capy.js" ~/.local/bin/capy

capy init                    # or export CAPY_API_KEY=capy_…
capy projects list

# optional Claude Code skills
ln -s "$PWD/skills/capy" ~/.claude/skills/capy
ln -s "$PWD/skills/capy-fleet-hq" ~/.claude/skills/capy-fleet-hq
```

If `capy` is not found, add `~/.local/bin` to `PATH`.
Both `~/.capy/config.json` and `~/.capy/.env` must be mode 0600; capy refuses to read either file
when it is accessible by group or other users.
Human terminal output strips API-controlled escape/control sequences; JSON output remains exact and
escaped for machine consumers.

Models accept a full API id plus the static convenience aliases `opus`, `sonnet`, and `haiku`.
Thread creation can independently set Captain and builder settings: `--model` / `--reasoning` and
`--buildModel` / `--buildReasoning`. Omitted values resolve from `defaultModel`, `defaultReasoning`,
`defaultBuildModel`, and `defaultBuildReasoning` in `~/.capy/config.json` (or the matching
`CAPY_DEFAULT_*` environment variables). For example:

```json
{
  "defaultModel": "gpt-5.6-terra",
  "defaultReasoning": "max",
  "defaultBuildModel": "gpt-5.6-terra",
  "defaultBuildReasoning": "max"
}
```

`GET /v1/models` reports availability and `captainEligible`; it does **not** provide aliases,
defaults, or builder eligibility. `capy models list` exposes that live data, and `capy init` offers
separate Captain/builder default pickers; the create endpoint validates the selected role/model and
effort combination.

## OpenAPI status

The vendored official spec was refreshed on **2026-07-10** and contains **26 paths / 37
operations**. It adds `runState: stopping`, `origin: github`, queued/deduplicable message fields,
`external_xai` usage routing, current model ids, and versioned multi-trigger automations.

Six warm-pool operations from the older document are absent from the current public spec. capy-kit
therefore treats warm-pool as de-publicized and unsupported; this does not prove the server routes
were deleted.

The current registry has 11 Ops, so important official functionality remains to be implemented:

- thread archive/unarchive/tags/session-token;
- task get/diff and project tag management;
- usage;
- setup, snapshots, browser snapshots, personal environment variables, automations, and session
  verification;
- selected new create/message fields such as speed, browser snapshot ids, and message-time build
  settings.

Local usage points to completing the work/observe controls first. Environment parity, automatic
projections, MCP, and publishing follow explicit prioritization rather than a stale milestone order.

## Development

```bash
npm run gen          # regenerate packages/core/src/client/schema.d.ts
npm run gen:check    # regenerate and check for a diff
npm run typecheck
npm test
npm run build
```

There is currently no `gen:skills` script or checked-in hosted CI workflow.

## Design documents

- [PLAN.md](./PLAN.md) — current status, usage lessons, and prioritized roadmap.
- [AGENTS.md](./AGENTS.md) — repository conventions and API facts.
- [SPEC.md](./SPEC.md) — target architecture, clearly separated from as-built truth.

## License

MIT — see [LICENSE](./LICENSE).
