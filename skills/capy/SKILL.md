---
name: capy
description: Use the current Capy API through the capy CLI to create, observe, steer, interrupt, and archive threads.
allowed-tools: Bash(capy:*)
---

# Current Capy API

Set `CAPY_API_KEY` to an organization-scoped Capy API key. The base URL is `https://api.capy.ai/api/v1`. The API cannot discover projects, so thread listing and creation require a configured project ID. Run `capy init` to save named IDs and choose a primary one; use `capy projects` to edit them later without replacing the key. Commands use the primary project unless `--project <configured-name-or-raw-id>` is supplied.

## Drive one durable thread

```bash
capy delegate 'Investigate the failing integration' caller-stable-request-id --json
capy threads list --status active --project central --json
capy threads message jam_123 'Focus on the failing test' --delivery steer --json
capy threads interrupt jam_123 --json
capy threads archive jam_123 --json
```

Create uses `requestId` and `message`; reuse a request ID only to retry the same logical creation. A message uses `text` and optional `delivery` (`interrupt`, `queue`, `steer`) and is deliberately not retried automatically. The returned message `id` controls queued work:

```bash
capy threads cancel-message jam_123 evt_123 --json
capy threads send-message-now jam_123 evt_123 --json
```

Thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`. Poll while work is `active` or `waiting`; all other states settle. Lists return `{items,cursor}`. Pass a non-null `cursor` unchanged; thread lists use `cursor`, while task and message transcripts use `after`.

## Observe; drive through the root thread

Tasks are read-only child work. Use them to understand progress, cost, and a subagent’s transcript; to change course, message the root thread rather than the task.

```bash
capy threads tasks jam_123 --json
capy tasks get task_123 --json
capy tasks messages task_123 --json
capy usage get --from 2026-08-01T00:00:00Z --json
```

## Reviews are a Capy capability, not a local gate

Use `capy reviews start --repo owner/repo --prNumber 123 --json` to request a review on a stable PR head. Configure review settings or billing-transfer state only when the user specifically asks; do not turn either into an approval policy or duplicate review loop.

Do not use retired project/model/configuration/automation/session APIs, `nextCursor`, or `hasMore`.
