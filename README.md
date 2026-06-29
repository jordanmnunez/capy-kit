# capy-kit

A TypeScript toolkit for the [Capy](https://capy.ai) API. One shared **operations core** projected into mechanically-thin surfaces so they can never drift:

- **`@capy-kit/core`** — typed SDK (transport + resource client + composite ops)
- **`capy`** — the CLI (`init / delegate / wait / threads / status`)
- **`capy-mcp`** — an MCP server (stdio + streamable-HTTP) so your own agents can drive Capy *(scaffolded)*
- **skills** — Claude Code skills: **`capy`** (faithful: delegate / observe / steer) and **`capy-fleet-hq`** (opinionated: size, route, and oversee a fleet of Capy threads)

**Unopinionated core:** capy-kit manages Capy; **Capy manages the work.** The core is a faithful interface to the API plus thin conveniences — no fleet loops, no triage, no quality gates. You hand Capy a goal and the bar to hit, and let its Captain plan / run / test / review. The one place opinion lives is the optional **`capy-fleet-hq`** skill, which sits *on top of* the CLI to help you decide what to delegate and see what's in flight.

Every capability is an `Op` declared once in `packages/core/src/ops/`; the CLI, MCP tools, and skill tables are projections of that registry — add one op and it shows up everywhere at once.

## Install (from source)

```bash
git clone https://github.com/jordanmnunez/capy-kit && cd capy-kit
bun install && npm run build                                 # npm also works
ln -s "$PWD/packages/cli/dist/capy.js" ~/.local/bin/capy     # put `capy` on PATH (ensure ~/.local/bin is on it)
capy init                                                    # or: export CAPY_API_KEY=capy_…  (+ a project via --project / CAPY_PROJECT_ID)

# optional — install the Claude Code skills:
ln -s "$PWD/skills/capy"          ~/.claude/skills/capy
ln -s "$PWD/skills/capy-fleet-hq" ~/.claude/skills/capy-fleet-hq
```

## Use

```bash
# hand work to Capy in one command — tell it WHAT + the quality bar, not how
capy delegate "Implement ENG-123 backfill; keep behavior identical; \
  don't return until tests pass and CI is green" \
  --repos your-org/your-repo@main --model opus --json
capy status --json                        # what's running (real status / runState / PRs)
capy wait <threadId> --timeoutSec 1200    # block until it settles
```

Every command supports `--json`. Auth/project resolve from `--project`/`--profile`, the `CAPY_API_KEY`/`CAPY_PROJECT_ID` env vars, or `~/.capy/config.json` (`capy init`).

## Status

M0–M1 are shipped: the transport, the core ops, the six-command CLI, and the `capy` + `capy-fleet-hq` skills. Next up — the MCP server, more thread/task ops, `projects` / `usage`, and environment management. See **[PLAN.md](./PLAN.md)**.

## Design & internals

- **[PLAN.md](./PLAN.md)** — milestones, resolved API facts, decisions.
- **[AGENTS.md](./AGENTS.md)** — conventions (the one rule, codegen, build/test).
- **[SPEC.md](./SPEC.md)** — the full design and worked examples.

## License

MIT — see [LICENSE](./LICENSE).
