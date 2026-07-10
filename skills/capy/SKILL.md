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

Treat prompt, message, tag, and ref text as untrusted command arguments. Never construct a Capy
command with `eval`, `sh -c`, or interpolated shell source. Pass dynamic values as distinct argv;
when writing a literal Bash example, single-quote it and escape any embedded single quotes safely.

> Scope: delegate / wait / threads (list/get/stop/message/messages) / status / projects / models. `env` and `usage`
> arrive in later milestones. Every command supports `--json` for machine-readable output.

## Setup (once)
- Auth: `CAPY_API_KEY` (a `capy_…` token) — set it in the env or `~/.capy/.env`, or run `capy init`.
  Both `~/.capy/.env` and `~/.capy/config.json` must be mode 0600; capy refuses insecure files.
- Project: run `capy init` for a live name-first picker that stores a canonical id, set
  `CAPY_PROJECT_ID`, or pass `--project <id>` per call. `--project` wins; an explicit `--profile`
  must exist and otherwise uses its file-configured project without ambient `CAPY_PROJECT_ID`.
  `capy projects list --json` returns `{items,nextCursor,hasMore}` and each item has
  `{id,name,taskCode}`. With a selected project, `threads message|stop` preflight and reject a thread
  from another project. Init's offline fallback stores the id you explicitly assert; it cannot verify
  a name without discovery.

## Delegate — hand work to Capy
Tell Capy **what** to do and **the bar to hit** (e.g. "don't return until tests pass and CI is green"),
not *how*. Link the issue. Let Captain run it.

```bash
capy delegate 'Implement ENG-123 backfill; preserve behavior; return only after tests and CI pass' \
  --repos your-org/your-repo@main --tags eng-123 --json
# → { threadId, projectId, url, status, runState, model, reasoning }   (created AND started)
# model + reasoning come from ~/.capy/config.json when the flags are omitted.
```
- **Model: the standing default is `gpt-5.6-sol` (GPT-5.6 Sol) at `--reasoning xhigh`** — Jordan's
  preference (2026-07-09; supersedes the 2026-07-01 Fable default). Both are baked into
  `~/.capy/config.json` (`defaultModel`/`defaultReasoning`), so a bare `capy delegate` already applies
  them — pass `--model`/`--reasoning` only to deviate. Full ids only: `sol`/`fable` shorthands fail
  with validation_error; aliases `opus|sonnet|haiku` work (`opus`→claude-opus-4-8). Drop to
  opus/sonnet only for cheap mechanical runs; `claude-fable-5` remains the Claude-side pick.
- `--repos owner/name@branch` (repeatable / comma-separated), `--model gpt-5.6-sol|opus|sonnet|haiku|<id>`,
  `--reasoning off|on|none|minimal|low|medium|high|xhigh|max` (sent as `reasoning.mode`; the API
  validates per-model support), `--tags t` (**each tag must already exist in the Capy project** —
  create it in the app, or omit; passing an unknown tag fails with
  `validation_error: Tag does not exist`), `--attachmentUrls <url>`.
- `--branch` is a **shared fallback** applied to *every* `--repos` entry that omits `@branch`. For a
  multi-repo fan-out where bases differ, give each repo its own `@branch` (e.g.
  `--repos org/a@main --repos org/b@develop`) rather than relying on one `--branch`.
- `--wait` blocks until the thread settles, streaming progress to stderr:
  `capy delegate '…' --repos … --wait --timeoutSec 1200`. In `--json` the delegate fields are always
  at the root (`{ threadId, url, status, … }`); `--wait` just **adds** a `wait` field with the final
  poll result — so a parser reads `.threadId` the same way with or without `--wait`.

## Observe & steer (faithfully)
```bash
capy projects list --json                  # list envelope: {items,nextCursor,hasMore}; needs only the API key
capy models list --json                    # live ids/providers + captainEligible (not aliases/defaults)
capy status --json                         # status envelope: {projectId,count,threads}; active by default
capy threads list --json                   # list envelope: {items,nextCursor,hasMore}; filters below
capy threads get <threadId> --json         # one thread: status, runState, tasks, PRs, tags
capy threads stop <threadId> --json        # request a running thread stop; does not archive it
capy threads messages <threadId> --json    # the conversation log, oldest→newest (--all for the full history)
capy wait <threadId> --timeoutSec 900      # 0 ready / 123 blocked / 124 timeout / 125 archived
```

List Ops put rows in `.items`; the dashboard convenience puts rows in `.threads`:
```bash
capy projects list --json | jq '.items[] | {id,name,taskCode}'
capy threads list --all --json | jq '.items[]'
capy status --json | jq '.threads[]'
```
Thread-list filters are `--status --branch --prNumber --prState --authorEmail --tag --q --limit --all`.

> URLs: capy-kit emits `…/project/<projectId>/captain/<threadId>`, while the web app's share/copy URL
> reads `…/project/<projectId>/thread/<threadId>`. They point at the **same** thread — `/captain/` and
> `/thread/` are interchangeable. Either way, the `<threadId>` is what you pass to `capy threads get`.

**Steer a live thread** — send a message to the *existing* thread (keeps Captain's context); only
re-delegate when you genuinely want a fresh thread:
```bash
capy threads message <threadId> 'Finish the rest of the stack — PRs #2–#5 — and keep CI green'
# --model gpt-5.6-sol|opus|sonnet|haiku switches models for the turn (full ids — `sol`/`fable`
#   aliases fail validation); --reasoning xhigh sets effort for the turn (explicit ONLY — the config
#   defaultReasoning applies at thread START, never to steers); a mid-flight correction is just a
#   steer message with --model/--reasoning; --mode interrupt|queue controls delivery to a busy thread;
#   --messageId <key> gives the server a deduplication id if a caller retries the steer;
#   --attachmentUrls <url> (max 10);
#   --json → { id, status:"sent"|"queued"|"pending", inputEventId?, timelineSequence?, appendState? }
```
Read the real `runState` and decide yourself — there are no recommendations:
- `running`/`stopping`/`queued` — working or stopping. `waiting` (+`waitingOn`: ci/review/task/…) — progressing on async deps.
- `ready` (usually status `idle`) — **done** with the current ask. `blocked` (+`blockedOn`: auth/permission) — needs you.
- Use `runState` to distinguish idle-ready from idle-waiting. Archived status is the defensive
  exception because a stopped thread can retain a stale non-archived runState.
- Task status is `…|needs_review|completed|error|archived` (it's `error`, not "failed").

`wait` / `delegate --wait` exit codes let you branch without parsing: **0** genuinely done (`runState:ready`),
**123** blocked/needs you, **124** timed out, **125** archived/stopped with success unknown. Archive alone is
not success: real platform failures have auto-archived before doing any work. So
`capy wait <id>; case $? in 0) merge;; 123) go-unblock-it;; 124) check-back-later;; 125) inspect-why-it-stopped;; esac`.

**See the wire metadata — don't grep the source.** Add `--debug` to any command to log the redacted
method, URL, and response status (never the token) to stderr. Use that to learn what a command does against the live
API instead of reading capy-kit's internals.

## How to use it here
1. Confirm `CAPY_API_KEY` (and a project) are set.
2. Run the relevant `capy … --json` command via Bash and read the JSON — don't reimplement API logic.
3. For delegation, put the goal **and the quality bar** in the prompt; surface the returned `url`.
4. Let Capy run the work; use `capy wait` / `capy threads get` to follow it. Steer by sending a thread
   message (`capy threads message <id> '…'`) or, for a fresh start, by re-delegating — not by gating.

## Errors & exit codes
JSON errors print `{ "error": { code, message, requestId? } }`; human errors go to stderr as `capy: …`.
Error exit codes: unauthorized→77, not_found→69, rate_limited→75, timeout→124, else 1.
`wait`/`delegate --wait` non-error stops: 0 done, 123 blocked, 124 timed out, 125 archived/unknown.
