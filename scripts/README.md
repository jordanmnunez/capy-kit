# scripts/

Build/codegen helpers. `gen-skills.ts` (built in the Skills milestone) regenerates the command/gate
tables embedded in each `skills/*/SKILL.md` and the consumer `AGENTS.md` from `capy commands --json`,
so docs can never drift from the ops registry. Run via `npm run gen:skills` (Bun).
