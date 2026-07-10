# spec/

`capy.openapi.json` — the **Capy API** OpenAPI 3.1 document (title "Capy API" v1.0.0, base `https://capy.ai/api`, bearer auth, **26 paths / 37 operations**).

- **Source:** `https://docs.capy.ai/openapi.json` (note: the **docs** host, not `capy.ai/api/...`).
- **Vendored:** 2026-07-10 (upstream `Last-Modified: Fri, 10 Jul 2026 12:00:58 GMT`,
  `ETag: W/"e7b36f8bbe995cf879174a6439e28bef"`).
- **SHA-256:** `2ecf130df865bc5c99193814830f83bd46fbeb9f43f455a8a7deb484639969bd`.
- **Use:** the single source of truth for the typed client. Regenerate with `npm run gen` (`openapi-typescript spec/capy.openapi.json -o packages/core/src/client/schema.d.ts`). The generated file is committed; `npm run gen:check` fails on drift.
- **Refresh:** re-fetch from the source URL when Capy ships API changes, re-run `npm run gen`, and re-derive any status enums in `packages/core/src/model.ts`.

Key shapes already mined (see `PLAN.md` / `AGENTS.md`): real `Task.status` / thread `status`+`runState` enums, `Task.threadId`, and the `UsageResponse` cost/`routed` shape.

The 2026-07-10 refresh removed the six legacy warm-pool operations from the public spec and added
`runState: stopping`, `origin: github`, current model ids, queued/deduplicable thread-message fields,
`external_xai` usage routing, and versioned multi-trigger automation configuration.
