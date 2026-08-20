---
name: capy
description: Use the current Capy API through the capy CLI to create, observe, steer, interrupt, and archive threads.
allowed-tools: Bash(capy:*)
---

# Current Capy API

Set `CAPY_API_KEY` to an organization-scoped Capy API key. The base URL is `https://api.capy.ai/api/v1`. The API cannot discover projects, so thread listing and creation require a configured project ID. Run `capy init` to save named IDs and choose a primary one; use `capy projects` to edit them later without replacing the key. Commands use the primary project unless `--project <configured-name-or-raw-id>` is supplied. `--profile <name>` selects a config profile and ignores ambient project/author environment defaults.

```json
{
  "projects": { "work": "project-id" },
  "defaultProject": "work",
  "authorId": "user-default",
  "profiles": {
    "operator": { "projectId": "work", "authorId": "user-operator" }
  }
}
```

## Drive one durable thread

```bash
capy delegate 'Investigate the failing integration' caller-stable-request-id --model-id openai/gpt-5.6-sol --json
capy delegate 'Investigate the failing integration' caller-stable-request-id --model-id openai/gpt-5.6-sol --author-id usr_123 --json
capy delegate 'Investigate without attribution' caller-stable-request-id --model-id openai/gpt-5.6-sol --profile operator --no-author --json
capy threads list --status active --project work --json
capy threads message jam_123 'Focus on the failing test' --delivery steer --json
capy threads interrupt jam_123 --json
capy threads archive jam_123 --json
```

Create uses `requestId`, `message`, and an explicit `--model-id`; reuse a request ID only to retry the same logical creation. `authorId` resolves from `--author-id`, then `CAPY_AUTHOR_ID`, the selected profile, and top-level config. `--no-author` deliberately suppresses the configured default. Look up IDs with `capy users list`. The returned `url` is the canonical Capy thread link: `https://capy.ai/thread/<thread-id>`. A message uses `text` and optional `delivery` (`interrupt`, `queue`, `steer`) and is deliberately not retried automatically. The returned message `id` controls queued work:

```bash
capy threads cancel-message jam_123 evt_123 --json
capy threads send-message-now jam_123 evt_123 --json
```

Thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`. Poll while work is `active` or `waiting`; all other states settle. Lists return `{items,cursor}`. Pass a non-null `cursor` unchanged; thread lists use `cursor`, while task and message transcripts use `after`.

`ready_for_review` is a Capy thread state only. It does not prove a pull request exists, CI is green, review is approved, the change is merged, or it is deployed. Verify each mutable lifecycle predicate in its owning system.

## Organize organization threads

```bash
capy users list --json
capy folders list --json
capy folders threads fld_123 --json
capy folders file fld_123 jam_123,jam_456 --json
capy folders unfile fld_123 jam_456 --json
capy folders pin jam_123 --user-id usr_123 --json
capy folders unpin jam_123 --json
```

Folder filing and pinning return an outcome for each requested thread (`ok`, `not_found`, or `not_allowed`). `--user-id` targets an organization user for pinning; omit it to use the API default. The public API can list and use existing folders but cannot create one.

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

Do not use unavailable project/model/configuration/session APIs, `nextCursor`, or `hasMore`. Automations are published but intentionally out of scope for this CLI.
