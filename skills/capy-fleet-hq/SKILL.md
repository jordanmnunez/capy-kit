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
- **Say the output shape — it's the third lever beside *what* and *the bar*.** Capy won't guess how you
  want the work packaged, and a fan-out left unspecified comes back as a sprawl of loosely-related PRs
  you then restack by hand. Spell it out in the prompt: *"one PR"*, *"a Graphite stack of N PRs (PR1 =
  …, PR2 stacked on PR1)"*, or *"work these as SEPARATE, sequenced PRs — not one big PR."*
- Add `--wait --timeoutSec 1200` to block on one; otherwise dispatch several and watch them below.

**Orient vs ship — say which you want (the two-step gate).** An open-ended *"orient to this project,
don't fan out any work yet"* prompt is **research-only by design** — Capy returns a plan, not PRs. That
is the deliberate first step of the proven Mail-Triage shape, but it only ships after a **second,
explicit authorize** turn (e.g. *"looks good — kick everything off and manage all the builders"*). So:
- **Want a plan / safe survey, or the work is irreversible** (deletes, config, deploys)? Open with
  orient + a hard recommend-only gate: *"DO NOT take any action — reply with a recommendation only,"* or
  *"before deleting anything, grep for live references; if you find one, stop and report."*
- **Want shipped code now?** Skip "orient" as the opener — name the file/edit and the bar in one
  `delegate`. A bare *"orient to X"* will stall in research; it won't ship without the authorize turn.

## 4. Overview — the fleet dashboard

`capy status` is a flat list with **no buckets** by design. Here you add the buckets. Pull the real
state, then group it:

```bash
capy status --json                                   # active threads for the current project
capy status --authorEmail you@co.com --json          # YOUR work only — shared projects bury it otherwise
capy threads list --all --tag my-campaign --json     # a whole campaign across pages
# more than one project: repeat with --project <id> / --profile <name>
```
On a **team-shared** project your threads are a few among everyone's — scope the dashboard to your own
work with `--authorEmail` (or set `CAPY_AUTHOR_EMAIL` once to make it the default), and/or `--origin` to
a single source. Then read each thread's real `runState` / `waitingOn` / `blockedOn` / PR and sort into
three buckets:

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
