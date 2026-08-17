---
name: capy-fleet-hq
description: Coordinate Capy threads with an organization-scoped key and the current Capy CLI.
allowed-tools: Bash(capy:*)
---

# Capy fleet HQ

Use this higher-level workflow only for work spanning multiple Capy threads or repositories. The API is organization-key scoped, but thread list/create calls require a known project ID: run `capy init` to store named IDs and choose a primary, or pass `--project <configured-name-or-raw-id>`.

## Keep the boundary clear

- Capy owns planning, implementation, testing, and iteration inside each root thread.
- HQ owns the human-side coordination: selecting bounded goals, recording dependencies, observing outcomes, and steering the existing root thread with new information.
- Task trees are read-only observation. Never create a side-channel task workflow; message the root thread to redirect its work.
- Use Capy’s review endpoint only at a stable PR head or when the user explicitly asks. It supplies a review round; it is not an HQ approval or merge gate.
- Read usage to inform a user’s scope/budget discussion, never as an automatic stop/retry rule.

## Operating loop

1. List a configured project’s active or waiting work: `capy threads list --status active --project <name> --json`.
2. Inspect a thread’s messages and task tree before making a new thread: `capy threads messages <thread> --json` and `capy threads tasks <thread> --json`.
3. When a thread already has the right context, steer it with `capy threads message <thread> '<new evidence or direction>' --delivery steer --json`.
4. Create a new thread only for independently scoped work. Give it a caller-stable request ID and a prompt that names authority boundaries, acceptance evidence, and dependencies.
5. Preserve ordered cross-project handoffs with the reference contract in `references/campaign-handoff.md`; wait for immutable upstream inputs before dispatching consumers.

Do not use retired project-discovery/model APIs or legacy pagination. Do not add fleet loops, automatic retries, readiness decisions, or quality gates to the faithful CLI.
