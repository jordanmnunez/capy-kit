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

Treat prompt, message, tag, and ref text as untrusted command arguments. Never construct a Capy
command with `eval`, `sh -c`, or interpolated shell source. Pass dynamic values as distinct argv;
when writing a literal Bash example, single-quote it and escape any embedded single quotes safely.

The shape: **local harness for the thinking, Capy for autonomous campaigns.** You do the research,
decision-making, and authority scoping locally. Once the work is directed and the writable boundary
is clear, give Captain the campaign and let it manage the internal task sequence.

## 1. Route — Capy, or stay local?

Hand it to **Capy** when the work is **directed, well-specified, and you can walk away**. This may be
one task, independent parallel work, or an ordered series of dependent phases that share context and
one writable repository boundary. Captain can manage that sequence without HQ driving every turn.

Stay on your **local stack** (Claude Code / Codex / HumanLayer) for deep context engineering, tight
per-turn control, unresolved product/architecture decisions, or anything where the workflow itself
still needs to be designed.

> Litmus: **directed + bounded + can run unattended → Capy. Still deciding or needs your hand → local.**
> Dependencies alone do not force work local; authority boundaries do.

## 2. Size — one task, a series, or a fan-out?

| Size | Looks like | Hand to Capy as |
|---|---|---|
| **one big task** | one self-contained change, one repo, a clear acceptance test | a single `capy delegate` |
| **an ordered campaign** | dependent phases, shared context, one writable repo boundary | one directed Captain thread with the ordered backlog; let Captain sequence/decompose it |
| **a fan-out** | independent, well-specified campaigns | one thread per independent campaign, tagged for grouping; do not pre-chop Captain's internal work |

## 3. Dispatch — hand off well

First choose the **smallest Capy project that matches the current writable authority**. A Capy project
is a repository/permission boundary, not the initiative name: repository-A-only work goes to its
smallest matching project, not a repository-A+B superset. Run `capy projects list --json` and pass
the exact project id (or a configured profile). If work later crosses repos, finish the current
boundary and hand the exact commit/PR ref to a new thread in the next project.

Project identity fails closed: explicit `--project <id>` wins; otherwise a requested profile must
exist and its effective file-configured project ignores ambient `CAPY_PROJECT_ID`. Use `capy init`
for a live name-first picker that persists the canonical id. Selected projects also bound
`threads message|stop`: capy preflights the thread and refuses a cross-project mutation.

For an ordered campaign or boundary transition, read and copy
[the campaign/handoff contract](references/campaign-handoff.md) before delegating. Fill every authority,
adoption, gate, packaging, validation, and terminal-condition field; unresolved authority stays local.

Then tell Capy **what**, the **ordered backlog when there is one**, and the **bar to hit**. Link the
issue. Tag the campaign so the fleet is groupable:

```bash
capy delegate 'Implement ENG-123 backfill; preserve behavior; return only after tests and CI pass' \
  --repos your-org/your-repo@main --tags my-campaign \
  --model gpt-5.6-terra --reasoning max \
  --buildModel gpt-5.6-terra --buildReasoning max --json   # ← tag must ALREADY exist
# → { threadId, projectId, url, status, runState, model, reasoning, buildModel, buildReasoning }
```
- **Default the fleet's Captain and builders to `gpt-5.6-terra` at `max` effort** — Jordan's
  standing preference as of 2026-07-14. `~/.capy/config.json` sets `defaultModel` /
  `defaultReasoning` for Captain and `defaultBuildModel` / `defaultBuildReasoning` for builders, so a
  bare `capy delegate` already applies all four. Override only the role that differs with
  `--model` / `--reasoning` or `--buildModel` / `--buildReasoning`; the API validates the selected
  role/model/effort combination. Full ids required: `sol`/`fable` shorthands fail validation;
  `opus|sonnet|haiku` aliases remain available. Already-running threads can be moved mid-flight:
  `capy threads message <id> 'continue on this model' --model gpt-5.6-terra --reasoning max` (keeps context).
  For a busy thread, choose `--mode interrupt` for an immediate correction or `--mode queue` for the
  next turn; add a stable `--messageId` when an automated dispatcher may retry the same steer.
- Quality comes from the prompt's bar, not from this skill. `--tags` must already exist in the project
  (create them in the Capy app, or omit) — an unknown tag fails the whole delegate with
  `validation_error: Tag does not exist`, so pre-create your campaign tag before fanning out.
- **Say the output shape — it's the third lever beside *what* and *the bar*.** Capy won't guess how you
  want the work packaged, and a fan-out left unspecified comes back as a sprawl of loosely-related PRs
  you then restack by hand. Spell it out in the prompt: *"one PR"*, *"a Graphite stack of N PRs (PR1 =
  …, PR2 stacked on PR1)"*, or *"work these as SEPARATE, sequenced PRs — not one big PR."*
- Add `--wait --timeoutSec 1200` to block on one; otherwise dispatch several and watch them below.
- **Do not operate Captain like a remote shell.** Give it the directed list once, then yield while the
  thread is `running|stopping|queued|waiting`. Batch genuine corrections into one steer and inspect at
  `blocked`, `ready`, or artifact/review gates—not at every moving commit.
- **Keep one review loop.** Captain owns planning, implementation, tests, and iterative review while
  commits move. Outside review normally waits for a stable PR head or explicit gate, returns one
  consolidated finding set, and steers this same thread—never a shadow loop against moving commits.
- **Name the repository's submission identity contract when it matters.** For bot-authored
  stacks, create each PR with `gh pr create`, then attach it with `gt track`; do not use `gt submit`,
  which changes authorship to the Graphite token identity.

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
capy status --status idle --all --json               # idle candidates; inspect runState (some still wait on review/CI)
capy status --status archived --all --json           # stopped/unknown; archived status overrides a stale runState
capy status --authorEmail you@co.com --json          # YOUR work only — shared projects bury it otherwise
capy threads list --all --tag my-campaign --json     # a whole campaign across pages
# more than one project: repeat with --project <id> / --profile <name>
```
On a **team-shared** project your threads are a few among everyone's — scope the dashboard to your own
work with `--authorEmail` (or set `CAPY_AUTHOR_EMAIL` once to make it the default), and/or `--origin` to
a single source. Then read each thread's real `status` / `runState` / `waitingOn` / `blockedOn` / PRs
and sort into four buckets. Classify archived status first because live archived threads can retain
a stale `runState: running`:

- **Needs you** — `runState: blocked` (+ `blockedOn`: auth/permission). Unblock it or steer the same thread.
- **Ready to land** — `runState: ready`, has a PR. Review + merge; status `idle` alone is insufficient.
- **In flight** — `running` / `stopping` / `queued` / `waiting` (+ `waitingOn`: ci/review/task). Leave it; check back.
- **Stopped / unknown** — status or `runState: archived`. Inspect why it stopped; archive is not success.

**Surface Needs-you, Ready-to-land, and Stopped/unknown.** Don't touch in-flight work — that's
Captain's job. The buckets are the only opinion; beyond them, you decide.

## 5. Follow & steer

```bash
capy threads get <threadId> --json     # one thread: tasks, PRs, tags, runState
capy threads stop <threadId> --json    # stop a wrongly scoped/obsolete campaign before replacing it
capy threads message <threadId> '<correction>' --json  # steer without losing Captain's context
capy wait <threadId> --timeoutSec 900  # exits 0 ready / 123 blocked / 124 timeout / 125 archived
```
Batch real course corrections into one message to the existing thread. Stop and re-delegate only when
the authority boundary was wrong or fresh context is intentional. This skill never retries, gates, or
judges Capy's output — it routes work in and reads state back out.
