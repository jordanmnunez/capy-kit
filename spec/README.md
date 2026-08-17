# spec/

`capy.openapi.json` — the **Capy API** OpenAPI 3.1 document (title "Capy API" v1.0.0, server `https://api.capy.ai`, bearer auth, **21 paths / 24 operations**).

- **Source:** `https://docs.capy.ai/openapi.json` (note: the **docs** host, not `capy.ai/api/...`).
- **Vendored:** 2026-08-17.
- **SHA-256:** `3a998a0e78708a6fae1a04805bbfaaceba57f29ade005d12d044649629d94b24`.
- **Use:** the single source of truth for the typed client. Regenerate with `npm run gen` (`openapi-typescript spec/capy.openapi.json -o packages/core/src/client/schema.d.ts`). The generated file is committed; `npm run gen:check` fails on drift.
- **Refresh:** re-fetch from the source URL when Capy ships API changes, re-run `npm run gen`, and re-derive any status enums in `packages/core/src/model.ts`.

The current contract covers thread/message control, read-only tasks, reviews, and usage. Retired project/configuration/automation/model APIs are deliberately absent; see `PLAN.md` for the supported boundary.
