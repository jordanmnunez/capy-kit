# skills/

Claude Code skill packages for capy-kit (built in the Skills milestone). Each is a directory with a `SKILL.md`; the command tables inside are **generated from `capy commands --json`** (CI fails on drift). Symlink into `~/.claude/skills/` or a project's `.agents/skills/`.

**Philosophy:** these skills **manage Capy and its environment** — they do not orchestrate or gate the work. You delegate a goal and let Capy's Captain plan, run, test, review, and iterate on its own. No fleet loops, no triage/recommendation engine, no local quality gates. (See `SPEC.md` → "Design principle: stay out of Capy's way".)

Planned (4):
- **`capy-delegate`** — hand work to Capy and let Capy run it. Teaches the object model + delegation discipline (tell Capy **what** + the **quality bar**, not **how**; link the issue), then `capy delegate "<prompt>" --repo … --json` → capture the url → optionally `capy wait`. Captain does the rest; the skill never gates or retries on Capy's behalf.
- **`capy-work`** — observe & steer in-flight work, faithfully: `capy threads list`/`get`, `capy threads messages` to read, `capy threads message` to steer, `capy tasks diff` to inspect, `capy threads stop`/`archive`. Explains real `status`/`runState`/`waitingOn` and lets the reader decide — no buckets, no recommendations.
- **`capy-env`** — manage a project's environment & config: dev-environment **setup** (vmSize, init/checkout/startup phases, commands, hooks), **env vars/secrets**, **warm pool** VMs, **snapshots**, **automations**, and **models**.
- **`capy-usage`** — read spend: `capy usage --org … --from … --to … --json`, summarized per user/item with the `routed` breakdown.

Two-tier packaging per skill: a thin discoverable **card** (`SKILL.md` with trigger keywords + `allowed-tools: Bash(capy:*)`) and a deep loadable **manual** (object model, real status/runState semantics, faithful command reference with output shapes, prompting tips). All call the CLI's `--json` contract — never reimplement control flow.

`AGENTS.md` (the install runbook for *consumers* of capy-kit) is generated here too — distinct from the repo-root `AGENTS.md` (conventions for *building* capy-kit).
