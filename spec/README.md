# spec/

`capy.openapi.json` — the **Capy API** OpenAPI 3.1 document (title "Capy API" v1.0.0, server `https://api.capy.ai`, bearer auth, **31 paths / 37 operations**).

- **Source:** `https://docs.capy.ai/openapi.json` (note: the **docs** host, not `capy.ai/api/...`).
- **Vendored:** 2026-08-20.
- **SHA-256:** `530d92ec3e6337cf12368bb6b915450516e63b0685cb2c2d9cad9dddd2191140`.
- **Use:** the single source of truth for the typed client. Regenerate with `npm run gen` (`openapi-typescript spec/capy.openapi.json -o packages/core/src/client/schema.d.ts`). The generated file is committed; `npm run gen:check` fails on drift.
- **Refresh:** re-fetch from the source URL when Capy ships API changes, re-run `npm run gen`, and re-derive any status enums in `packages/core/src/model.ts`.

The current contract covers thread/message control, folders and pins, organization users, read-only tasks, reviews, usage, and a published automation surface. Project/configuration/model APIs remain absent. Automations are intentionally out of scope for capy-kit; see `PLAN.md` for the supported boundary.
