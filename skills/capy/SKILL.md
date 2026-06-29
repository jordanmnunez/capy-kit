---
name: capy
description: Delegate coding work to Capy (capy.ai) and observe/steer it from the terminal via the `capy` CLI. Use when asked to "hand this to Capy", "delegate to capy", "spawn a Capy thread", "check on my Capy threads/tasks", "wait for a capy thread", or to inspect Capy thread status, runState, diffs, or PRs. capy manages Capy; Capy (Captain) manages the work.
allowed-tools: Bash(capy:*)
---

# capy — delegate to Capy and observe it

`capy` is a thin, faithful CLI over the Capy API. **capy-kit manages Capy; Capy manages the
work.** You hand Capy a goal and the quality bar; its Captain plans, spawns tasks, runs tests,
reviews, and iterates on its own. This skill does **not** gate, retry, or judge the work — it
surfaces faithful state and faithful controls. Quality comes from the delegation prompt.

> Scope: this is the M1 surface (delegate / wait / threads / status). `env` and `usage` arrive
> in later milestones. Every command supports `--json` for machine-readable output.

## Setup (once)
- Auth: `CAPY_API_KEY` (a `capy_…` token) — set it in the env or `~/.capy/.env` (0600), or run `capy init`.
- Project: `CAPY_PROJECT_ID` (a UUID), or pass `--project <uuid>` per call. Find ids in the Capy web app.

## Delegate — hand work to Capy
Tell Capy **what** to do and **the bar to hit** (e.g. "don't return until tests pass and CI is green"),
not *how*. Link the issue. Let Captain run it.

```bash
capy delegate "Implement ENG-123 backfill; link the Linear issue; keep behavior identical; \
  don't come back until tests pass and CI is green" \
  --repos your-org/your-repo@main --model opus --tags eng-123 --json
# → { threadId, url, status, runState, model }   (the thread is created AND started)
```
- `--repos owner/name@branch` (repeatable / comma-separated), `--model opus|sonnet|haiku|<id>`,
  `--tags t`, `--attachmentUrls <url>`.
- `--wait` blocks until the thread settles, streaming progress to stderr:
  `capy delegate "…" --repos … --wait --timeoutSec 1200`. In `--json`, `--wait` emits one
  document `{ delegate, wait }`.

## Observe & steer (faithfully)
```bash
capy status --json                         # active threads: real status/runState/waitingOn/blockedOn/PR (no buckets)
capy threads list --json                   # full filters: --status --branch --pr --pr-state --authorEmail --tag -q --limit --all
capy threads get <threadId> --json         # one thread: status, runState, tasks, PRs, tags
capy wait <threadId> --timeoutSec 900      # poll until it settles (done / blocked / timeout)
```
Read the real `runState` and decide yourself — there are no recommendations:
- `running`/`queued` — working. `waiting` (+`waitingOn`: ci/review/task/…) — progressing on async deps.
- `ready` (status `idle`) — **done** with the current ask. `blocked` (+`blockedOn`: auth/permission) — needs you.
- Task status is `…|needs_review|completed|error|archived` (it's `error`, not "failed").

`wait` exits non-zero if it stops un-done (blocked or timed out); `terminal:true` means genuinely finished.

## How to use it here
1. Confirm `CAPY_API_KEY` (and a project) are set.
2. Run the relevant `capy … --json` command via Bash and read the JSON — don't reimplement API logic.
3. For delegation, put the goal **and the quality bar** in the prompt; surface the returned `url`.
4. Let Capy run the work; use `capy wait` / `capy threads get` to follow it. Steer by re-delegating
   or with thread messages (later milestone), not by gating.

## Errors & exit codes
JSON errors print `{ "error": { code, message, requestId? } }`; human errors go to stderr as `capy: …`.
Exit codes: unauthorized→77, not_found→69, rate_limited→75, timeout→124, else 1.
