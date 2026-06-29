# spec/

`capy.openapi.json` — the **Capy API** OpenAPI 3.1 document (title "Capy API" v1.0.0, base `https://capy.ai/api`, bearer auth, **31 endpoints**).

- **Source:** `https://docs.capy.ai/openapi.json` (note: the **docs** host, not `capy.ai/api/...`).
- **Vendored:** 2026-06-26.
- **Use:** the single source of truth for the typed client. Regenerate with `npm run gen` (`openapi-typescript spec/capy.openapi.json -o packages/core/src/client/schema.d.ts`). The generated file is committed; `npm run gen:check` fails on drift.
- **Refresh:** re-fetch from the source URL when Capy ships API changes, re-run `npm run gen`, and re-derive any status enums in `packages/core/src/model.ts`.

Key shapes already mined (see `PLAN.md` / `AGENTS.md`): real `Task.status` / thread `status`+`runState` enums, `Task.threadId`, and the `UsageResponse` cost/`routed` shape.
