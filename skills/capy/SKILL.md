---
name: capy
description: Use the current Capy API through the capy CLI to create, observe, steer, interrupt, and archive threads.
allowed-tools: Bash(capy:*)
---

# Current Capy API

Set `CAPY_SERVICE_USER_API_KEY` to a Capy service-user API key. The current base URL is `https://api.capy.ai/api/v1`; no project configuration is required.

```bash
capy delegate 'Investigate the failing integration' caller-stable-request-id --json
capy threads list --status active --json
capy threads message jam_123 'Focus on the failing test' --delivery steer --json
capy threads interrupt jam_123 --json
capy threads archive jam_123 --json
```

Create uses `requestId` and `message`; reuse a request id only when retrying that same logical create. Messages use `text` and optional `delivery` (`interrupt`, `queue`, `steer`) and are not retried automatically because sends do not have idempotency keys.

Thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`. Do not rely on legacy `runState`, projects/model APIs, `nextCursor`, or `hasMore`. Lists return `{items,cursor}` and pass a non-null cursor back unchanged.
