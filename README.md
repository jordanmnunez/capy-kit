# capy-kit

A TypeScript SDK and CLI for Capy's current public API. The legacy Capy API is intentionally unsupported.
The workspace packages are currently private and are not published to npm. For repository-local use, install dependencies and build the CLI:

```bash
bun install
npm run build
node packages/cli/dist/capy.js --help
```

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
  "defaultProject": "my-project",
  "authorId": "user_…",
  "profiles": {
    "work": {
      "projectId": "my-project",
      "authorId": "user_…"
    }
  }
}
```

Commands use that primary project by default. Use `--project secondary` to select another configured
name, or `--project <project-id>` for an explicit raw-ID override. `--profile work` uses that profile's project and author defaults and ignores ambient `CAPY_PROJECT_ID` and `CAPY_AUTHOR_ID`; this makes profile identity fail closed. `CAPY_PROJECT_ID` and `CAPY_AUTHOR_ID` remain useful for non-interactive CLI use. `capy projects` edits these local aliases; it does not call a project-discovery API.

```bash
capy delegate 'Investigate the failing integration' caller-stable-request-id --model-id openai/gpt-5.6-sol --json
capy delegate 'Investigate the failing integration' caller-stable-request-id --model-id openai/gpt-5.6-sol --reasoning-mode high
capy delegate 'Investigate without attribution' caller-stable-request-id --model-id openai/gpt-5.6-sol --profile work --no-author
capy threads list --status active --json
capy threads list --project secondary --json
capy users list --json
capy folders list --json
capy folders threads fld_123 --json
capy folders file fld_123 jam_123,jam_456 --json
capy folders unfile fld_123 jam_456 --json
capy folders pin jam_123 --user-id usr_123 --json
capy threads message jam_123 'Focus on the failure' --delivery steer --json
capy threads message jam_123 'Use a different model for this turn' --model-id openai/gpt-5.6-sol --fast
capy threads rename jam_123 --clear-title --json
capy threads interrupt jam_123 --json
capy threads archive jam_123 --json
capy threads tasks jam_123 --json
capy tasks messages task_123 --json
capy usage get --from 2026-08-01T00:00:00Z --json
capy reviews start --repo acme/checkout --prNumber 481 --json
```

Thread creation requires a caller-stable `requestId` and explicit `--model-id`; reuse a request ID only for retrying the same logical request. `authorId` resolves as `--author-id` > `CAPY_AUTHOR_ID` > selected profile > top-level config. Pass `--no-author` to deliberately omit the configured default. Discover organization user IDs with `capy users list`. Messages are deliberately not retried automatically. Thread lists and transcripts return `{items,cursor}`; supply a non-null cursor unchanged on the next request. The create result includes the canonical `https://capy.ai/thread/<thread-id>` URL.

Current thread statuses are `active`, `waiting`, `pending_user`, `error`, `ready_for_review`, `idle`, and `archived`.
`ready_for_review` is only a Capy thread state; it does not prove a pull request exists, checks are green, review is approved, the change is merged, or it is deployed.

The CLI also exposes current title, task, queued-message, usage, and review controls; run `capy --help` for the complete command tree. The official contract publishes automation operations, but automations are intentionally out of scope for capy-kit.
