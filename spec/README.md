# spec/

`capy.openapi.json` — the **Capy API** OpenAPI 3.1 document (title "Capy API" v1.0.0, server `https://api.capy.ai`, bearer auth, **33 paths / 39 operations**).

- **Source:** `https://docs.capy.ai/openapi.json` (note: the **docs** host, not `capy.ai/api/...`).
- **Vendored:** 2026-08-24.
- **SHA-256:** `3fda8953336151c06b7f5d668d7ca671ded90dd46699fda80d695e0b67a80781`.
- **Use:** the single source of truth for the typed client. Regenerate with `npm run gen` (`openapi-typescript spec/capy.openapi.json -o packages/core/src/client/schema.d.ts`). The generated file is committed; `npm run gen:check` fails on drift.
- **Refresh:** re-fetch from the source URL when Capy ships API changes, re-run `npm run gen`, and re-derive any status enums in `packages/core/src/model.ts`.

The current contract covers thread/message control, folders and pins, organization users, project listing/retrieval, read-only tasks, reviews, usage, and a published automation surface. Configuration/model APIs remain absent. Automations are intentionally out of scope for capy-kit; see `PLAN.md` for the supported boundary.
