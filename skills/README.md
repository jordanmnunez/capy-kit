# skills/

Portable agent skills for capy-kit. Each is a self-contained directory with a `SKILL.md`; install
or link it through the skills directory used by your Claude or Codex harness.

- **`capy`** — *faithful.* Drive and observe durable threads from the terminal: profiles and author
  attribution, delegation, root-thread steering, queued-message controls, users, folders and pins,
  read-only task observation, usage, and explicit review requests.
  You hand Capy a goal + quality bar; its Captain plans, runs, tests, reviews, and iterates.
- **`capy-fleet-hq`** — *opinionated.* Choose the correct Captain/thread ownership boundary, create
  explicit campaign and cross-project handoffs, record inspection triggers, and steer only when
  material truth changes. It coordinates through the `capy` CLI; it is not a dashboard, daemon, or
  automatic dispatcher.

**Principle:** capy-kit manages Capy; Capy manages the work. The `capy` skill surfaces real state and
faithful controls. `capy-fleet-hq` adds the human-side ownership and handoff decisions, then yields
to Captain until a declared inspection trigger or changed fact justifies intervention.
