# capy-kit

A TypeScript SDK and CLI for Capy's current public API. The legacy Capy API is intentionally unsupported.

Set an organization-scoped key from **Settings → API**:

```bash
export CAPY_API_KEY=capy_…
```

The default base URL is `https://api.capy.ai/api/v1`. The public API is organization-key scoped.

```bash
capy delegate 'Investigate the failing integration' caller-stable-request-id --json
capy threads list --status active --json
capy threads message jam_123 'Focus on the failure' --delivery steer --json
capy threads interrupt jam_123 --json
capy threads archive jam_123 --json
```

Thread creation requires a caller-stable `requestId`; reuse it only for retrying the same logical request. Messages are deliberately not retried automatically. Thread lists and transcripts return `{items,cursor}`; supply a non-null cursor unchanged on the next request.

Current thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`.
