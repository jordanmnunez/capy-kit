# capy-kit

A TypeScript SDK and CLI for Capy's current public API. The legacy Capy API is intentionally unsupported.

Set a Capy service-user key:

```bash
export CAPY_SERVICE_USER_API_KEY=capy_…
```

The default base URL is `https://api.capy.ai/api/v1`. The public API is organization-key scoped.

The public API requires a project ID for thread lists and creates, but cannot list or retrieve
projects. Configure the IDs you already know with `capy init`; give each a name and select a
primary project. For example:

```json
{
  "projects": { "central": "13301322-ef3d-4b2b-a602-9638fd053dc2" },
  "defaultProject": "central"
}
```

Commands use that primary project by default. Use `--project central` to select another configured
name, or `--project <project-id>` for an explicit raw-ID override. `CAPY_PROJECT_ID` remains useful
for non-interactive automation.

```bash
capy delegate 'Investigate the failing integration' caller-stable-request-id --json
capy threads list --status active --json
capy threads list --project central --json
capy threads message jam_123 'Focus on the failure' --delivery steer --json
capy threads interrupt jam_123 --json
capy threads archive jam_123 --json
```

Thread creation requires a caller-stable `requestId`; reuse it only for retrying the same logical request. Messages are deliberately not retried automatically. Thread lists and transcripts return `{items,cursor}`; supply a non-null cursor unchanged on the next request.

Current thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`.
