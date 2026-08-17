# capy-kit

A TypeScript SDK and CLI for Capy's current public API. The legacy Capy API is intentionally unsupported.

Set a Capy API key:

```bash
export CAPY_API_KEY=capy_…
```

The default base URL is `https://api.capy.ai/api/v1`. The public API is organization-key scoped.

The public API requires a project ID for thread lists and creates, but cannot list or retrieve
projects. Configure the IDs you already know with `capy init`; give each a name and select a
primary project. Later use `capy projects` to add or update IDs and change the primary project
without prompting for or replacing the API key. For example:

```json
{
  "projects": { "my-project": "your-project-id" },
  "defaultProject": "my-project"
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
capy threads tasks jam_123 --json
capy tasks messages task_123 --json
capy usage get --from 2026-08-01T00:00:00Z --json
capy reviews start --repo acme/checkout --prNumber 481 --json
```

Thread creation requires a caller-stable `requestId`; reuse it only for retrying the same logical request. Messages are deliberately not retried automatically. Thread lists and transcripts return `{items,cursor}`; supply a non-null cursor unchanged on the next request.

Current thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`.

The CLI also exposes current title, task, queued-message, usage, and review controls; run `capy --help` for the complete command tree.
