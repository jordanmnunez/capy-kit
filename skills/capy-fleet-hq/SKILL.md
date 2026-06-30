---
name: capy-fleet-hq
description: Opinionated HQ for running a fleet of Capy threads from your local harness — decide what to hand to Capy vs keep local, size and dispatch the work, and get a grouped overview of everything in flight. Use when asked to "manage my capy fleet", "what should I send to Capy", "size this for Capy", "give me a Capy overview/dashboard", "triage my running Capy threads", or to route research/plan output to Capy. Built on the `capy` CLI; capy-kit's core stays faithful — this is where the opinion lives.
allowed-tools: Bash(capy:*)
---

# capy-fleet-hq — run Capy as a fleet

The faithful `capy` skill hands one goal to Capy and surfaces raw state. **This skill is the
opinionated layer on top**: it helps you *decide* (what to delegate, how to size it) and *see* (one
grouped overview of everything in flight). It never gates Capy's work — **capy-kit manages Capy;
Capy manages the work.** Captain still plans, runs, tests, reviews, and iterates.

The shape: **local harness for the thinking, Capy for the fan-out.** You do the research and planning
locally (Claude Code, Codex, your editor); when the work is parallel and well-specified, you fan it
out to Capy and manage it from here.

## 1. Route — Capy, or stay local?

Hand it to **Capy** when the work is **independent, parallel, well-specified, and you can walk away**:
a backlog of self-contained tickets, a multi-repo sweep, a mechanical migration.

Stay on your **local stack** (Claude Code / Codex / HumanLayer) for deep context engineering, tight
per-turn control, brownfield single-hard-problems, dependency-linked sequences, or anything where the
workflow itself needs to be yours.

> Litmus: **independent + parallel + specified → Capy. Dependency-linked or needs-your-hand → local.**
> You own this call.

## 2. Size — one task, a series, or a fan-out?

| Size | Looks like | Hand to Capy as |
|---|---|---|
| **one big task** | one self-contained change, one repo, a clear acceptance test | a single `capy delegate` |
| **a series** | dependency-linked steps, shared context | dispatch the first independent piece; keep the ordering yours — don't fan dependent work in parallel |
| **a fan-out** | many independent, well-specified tickets | one Capy session per project, **tagged** so you can group them; let Captain decompose — don't pre-chop |

## 3. Dispatch — hand off well

Tell Capy **what** and **the bar to hit**, not how. Link the issue. Tag the campaign so the fleet is
groupable:

```bash
capy delegate "Implement ENG-123 backfill; link the Linear issue; keep behavior identical; \
  don't return until tests pass and CI is green" \
  --repos your-org/your-repo@main --model opus --tags my-campaign --json   # ← tag must ALREADY exist
# → { threadId, url, status, runState, model }   — surface the url
```
- Quality comes from the prompt's bar, not from this skill. `--tags` must already exist in the project
  (create them in the Capy app, or omit) — an unknown tag fails the whole delegate with
  `validation_error: Tag does not exist`, so pre-create your campaign tag before fanning out.
- Add `--wait --timeoutSec 1200` to block on one; otherwise dispatch several and watch them below.

## 4. Overview — the fleet dashboard

`capy status` is a flat list with **no buckets** by design. Here you add the buckets. Pull the real
state, then group it:

```bash
capy status --json                                   # active threads for the current project
capy threads list --all --tag my-campaign --json     # a whole campaign across pages
# more than one project: repeat with --project <id> / --profile <name>
```
Read each thread's real `runState` / `waitingOn` / `blockedOn` / PR and sort into three buckets:

- **Needs you** — `runState: blocked` (+ `blockedOn`: auth/permission). Unblock it or re-delegate.
- **Ready to land** — status `idle` / `runState: ready`, has a PR. Review + merge.
- **In flight** — `running` / `queued` / `waiting` (+ `waitingOn`: ci/review/task). Leave it; check back.

**Surface only Needs-you and Ready-to-land.** Don't touch in-flight work — that's Captain's job. The
buckets are the only opinion; beyond them, you decide.

## 5. Follow & steer

```bash
capy threads get <threadId> --json     # one thread: tasks, PRs, tags, runState
capy wait <threadId> --timeoutSec 900  # block until it settles (done / blocked / timeout)
```
Course-correct by re-delegating with a sharper prompt. This skill never retries, gates, or judges
Capy's output — it routes work in and reads state back out.
