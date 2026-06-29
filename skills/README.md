# skills/

Claude Code skills for capy-kit. Each is a directory with a `SKILL.md`; symlink it into
`~/.claude/skills/` (or a project's `.claude/skills/`).

- **`capy`** — *faithful.* Delegate work to Capy and observe/steer it from the terminal
  (`init / delegate / wait / threads / status`). You hand Capy a goal + the quality bar; its Captain
  plans, runs, tests, reviews, and iterates. No gating, no orchestration.
- **`capy-fleet-hq`** — *opinionated.* Run a **fleet** of Capy threads from your local harness: decide
  what to hand to Capy vs keep local, size and dispatch the work, and get a grouped overview of what's
  in flight. Sits on top of the `capy` CLI — this is where the opinion lives.

**Principle:** capy-kit manages Capy; Capy manages the work. The `capy` skill surfaces real state +
faithful controls. `capy-fleet-hq` adds *your* side of the loop — deciding and observing — but never
gates, retries, or judges Capy's output.
