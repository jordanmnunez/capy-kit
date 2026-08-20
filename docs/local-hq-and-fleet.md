# Local HQ and Fleet — superseded design record

> Historical decision record from 2026-06-29. The proposed plugin marketplace, MCP projection,
> project-discovery API, dashboard, dispatcher, and persisted HQ runtime were not implemented.
> Do not use this document as current product or repository guidance.

The durable decision from the original proposal remains valid: capy-kit is the faithful API/CLI
layer, while human-side coordination belongs in the higher-level `capy-fleet-hq` skill. The
dependency points one way: Fleet HQ may consume `capy`; core and CLI do not depend on Fleet HQ.

Current authority lives in:

- `AGENTS.md` for repository implementation rules;
- `README.md` for the user-facing CLI and configuration surface;
- `PLAN.md` for implemented API coverage;
- `SPEC.md` for architecture and non-goals;
- `skills/capy/SKILL.md` for faithful operation;
- `skills/capy-fleet-hq/SKILL.md` for campaign ownership and handoffs.

Later usage corrected one important part of the June proposal. Dependency-linked work does not
automatically belong in a local stack. An ordered campaign contained within one authority boundary
can be delegated to one Captain with the complete queue. Independent outcomes use separate threads;
cross-boundary work uses a new thread and a formal handoff. Once Captain accepts ownership, HQ
records the handoff and waits for a meaningful inspection trigger instead of shadow-managing normal
progress.
