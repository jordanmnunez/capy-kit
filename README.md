# capy-kit

A TypeScript toolkit for the [Capy](https://capy.ai) API (the parallel-AI-coding cloud IDE). One shared **operations core** projected into four mechanically-thin surfaces so they can never drift:

- **`@capy-kit/core`** — typed SDK/library (transport + resource client + agent-shaped composite ops)
- **`capy`** — the CLI
- **`capy-mcp`** — an MCP server (stdio + streamable-HTTP) so your own agents can drive Capy
- **skills** — Claude Code skills (`capy-delegate`, `capy-work`, `capy-env`, `capy-usage`) to manage Capy and its environment

**Unopinionated by design:** capy-kit manages Capy; **Capy manages the work.** It's a faithful interface to the API (+ thin conveniences) and skills to drive Capy and its environment — no fleet loops, no triage/quality-gate orchestration. You tell Capy *what* and the *bar to hit*, and let Captain decide *how*.

The single structural idea: every capability is an `Op` declared **once** in `packages/core/src/ops/`; the CLI tree, MCP tools, and skill tables are generated from that registry. Add one op → it shows up in the SDK, CLI, MCP, and docs at once.

> **Status: scaffolded, not yet implemented.** This repo has the design, conventions, the vendored Capy OpenAPI spec, and toolchain config — but no source yet. See **[PLAN.md](./PLAN.md)** to start work.

## Read these in order
1. **[PLAN.md](./PLAN.md)** — status, milestones, resolved API facts, open questions, kickoff.
2. **[AGENTS.md](./AGENTS.md)** — conventions for an agent building here (the one rule, dep pins, codegen, build/test, don'ts).
3. **[SPEC.md](./SPEC.md)** — full design: architecture, every surface, auth, borrow-vs-improve, and concrete examples.

## Quick start (for the build agent)
```bash
bun install                 # Bun is the dev/install fast path (Node ≥18 is the runtime contract)
npm run gen                 # generate typed client from spec/capy.openapi.json
npm run typecheck && npm test
```

## Provenance
Clean-room design (2026-06-26) informed by the prior-art tool [`yazcaleb/capy-cli`](https://github.com/yazcaleb/capy-cli) — *ideas and pitfalls, not code* (it ships no license). Reconciled against the real Capy OpenAPI 3.1 spec, vendored at [`spec/capy.openapi.json`](./spec/capy.openapi.json).
