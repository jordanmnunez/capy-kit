# capy-kit

A TypeScript toolkit for the [Capy](https://capy.ai) API. One shared **operations core** — every capability declared once as an `Op` in `packages/core/src/ops/` — projected into mechanically-thin surfaces that can't drift from it.

**The principle:** *capy-kit manages Capy; Capy manages the work.* The core and its faithful surfaces are a thin interface to the API — no fleet loops, no triage, no quality gates. You hand Capy a goal and the bar to hit; its Captain plans / runs / tests / reviews. Opinion lives in exactly one place: the optional `capy-fleet-hq` skill.

The pieces:

- **`@capy-kit/core`** — the SDK / ops core
- **`capy`** — the CLI
- **`capy-mcp`** — the MCP server *(scaffolded)*
- **`capy` skill** — faithful Claude Code skill
- **`capy-fleet-hq` skill** — the opinionated fleet layer

---

## `@capy-kit/core` — the SDK

The single source of truth: a typed transport + resource client over the Capy API, plus a few composite ops (`delegate`, `wait`, …). Every capability is an `Op` declared once here; the CLI, the MCP tools, and the skills are all projections of that one registry — add an op and it shows up everywhere at once. Faithful by design: it maps the API, nothing more.

## `capy` — the CLI

A thin shell over the ops core — `init`, `delegate`, `wait`, `threads` (list / get / message / messages), `status`, `projects` (list / get) — and every one takes `--json` (and `--debug`).

```bash
capy delegate "Implement ENG-123 backfill; keep behavior identical; \
  don't return until tests pass and CI is green" \
  --repos your-org/your-repo@main --model opus --json
capy status --json                      # what's running (real status / runState / PRs)
capy wait <threadId> --timeoutSec 1200  # block until it settles
```

Every command also takes `--debug`, which logs the exact (redacted — never the token) HTTP request/response to stderr — use it to inspect live API behavior instead of reading the source.

## `capy-mcp` — the MCP server

The same ops registry exposed as MCP tools (stdio + streamable-HTTP), so your own agents and harnesses can drive Capy directly instead of shelling out. *Scaffolded — next on the roadmap.*

## skills — the `capy` skill (faithful)

A Claude Code skill for delegating to Capy and observing/steering it from your harness: hand off work, read real `status` / `runState` / `waitingOn` / PRs, follow with `wait`. It surfaces faithful state and faithful controls — no buckets, no recommendations. (Symlink `skills/capy` into `~/.claude/skills/`.)

## `capy-fleet-hq` — manage Capy as a fleet

This is the **opinionated** layer — the one place capy-kit takes a stance. It's a Claude Code skill that sits *on top of* the `capy` CLI: the core stays faithful, the opinion lives here. (Symlink `skills/capy-fleet-hq` into `~/.claude/skills/`.)

**The model:** *local harness for the thinking, Capy for the fan-out.* You do the research, planning, and hard single-threaded work in your local harness (Claude Code, Codex, your editor) — your machine is the HQ. When the work is parallel and well-specified, you fan it out to a fleet of Capy threads and run that fleet from here. How that plays out:

**1. Route — Capy, or stay local?**
Hand it to Capy when the work is **independent, parallel, well-specified, and you can walk away**. Stay local for deep context engineering, tight per-turn control, brownfield single-hard-problems, or dependency-linked sequences. *Litmus: independent + parallel + specified → Capy; dependency-linked or needs-your-hand → local.*

**2. Size — one task, a series, or a fan-out?**

| Size | Looks like | Dispatch as |
|---|---|---|
| **one big task** | one self-contained change, one repo | a single `capy delegate` |
| **a series** | dependency-linked steps | the first independent piece — keep the ordering yours |
| **a fan-out** | many independent, well-specified tickets | one Capy session per project, **tagged**; let Captain decompose |

**3. Dispatch.** Tell Capy *what* and the *bar to hit*, not how; tag the campaign so the fleet is groupable:
`capy delegate "<goal + bar>" --repos … --tags <campaign> --json`.

**4. Oversee — the fleet dashboard.** `capy status` is a flat list with no buckets *by design*; the HQ adds them. Pull the real state (`capy status --json`, `capy threads list --all --tag <campaign> --json`) and group it:

- **Needs you** — `runState: blocked` → unblock or re-delegate
- **Ready to land** — `idle` / `ready` with a PR → review + merge
- **In flight** — `running` / `queued` / `waiting` → leave it; check back

Surface only *Needs-you* and *Ready-to-land*; in-flight work is Captain's job.

**Where it's headed.** The natural extension is the full loop: research and plan locally → distill into Linear tickets → **size → route → dispatch → oversee → land** across a multi-project fleet. The shipped skill is the first cut of that; because the core underneath stays thin, this opinion can keep evolving without ever touching the faithful surfaces.

---

## Install (from source)

```bash
git clone https://github.com/jordanmnunez/capy-kit && cd capy-kit
bun install && npm run build                                 # npm also works

# put `capy` on your PATH — create ~/.local/bin and symlink the built bin into it:
mkdir -p ~/.local/bin && ln -s "$PWD/packages/cli/dist/capy.js" ~/.local/bin/capy
# if `capy` is then "command not found", ~/.local/bin isn't on PATH — add it:
#   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && exec $SHELL

capy init                                                    # or export CAPY_API_KEY=capy_…
capy projects list                                           # find a project id → --project / CAPY_PROJECT_ID

# optional — install the Claude Code skills:
ln -s "$PWD/skills/capy"          ~/.claude/skills/capy
ln -s "$PWD/skills/capy-fleet-hq" ~/.claude/skills/capy-fleet-hq
```

> The model picker in `capy init` is a convenience **snapshot** of a few ids — it can lag the platform.
> Any model the API accepts works via `--model` (aliases `opus` / `sonnet` / `haiku`, or a full id); the
> full alias map comes from `/v1/models` in a later milestone, so a stale picker never blocks you.

## Status

M0–M1 plus several M3 ops pulled forward are shipped: the transport, the core ops (`delegate`, `threads` list / get / message / messages, `wait`, `status`, `projects` list / get), the CLI, and the `capy` + `capy-fleet-hq` skills. Next up — the MCP server, `tasks` / `diff`, `usage`, and environment management. See **[PLAN.md](./PLAN.md)**.

## Design & internals

- **[PLAN.md](./PLAN.md)** — milestones, resolved API facts, decisions.
- **[AGENTS.md](./AGENTS.md)** — conventions (the one rule, codegen, build/test).
- **[SPEC.md](./SPEC.md)** — the full design and worked examples.

## License

MIT — see [LICENSE](./LICENSE).
