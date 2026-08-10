# Campaign and cross-project handoff contract

Use one of these templates before delegating an ordered campaign or moving work across a project
boundary. Replace every bracketed field. If the authority boundary or start gate is unknown, keep the
work local until it is resolved.

## Review boundary

- Let Captain own planning, implementation, testing, and iterative review while work is moving.
- Start outside review only at a stable PR head or an explicit review gate named below.
- Do not run a duplicate shadow-review loop against moving commits.
- Return one consolidated finding set, then steer the existing thread with that set.

## Ordered campaign prompt

```text
Campaign: [short outcome]

Current authority boundary
- Capy organization/account: [recognizable organization or workspace]
- Writable repositories: [owner/repo@base branch, ...]
- Read-only context allowed: [repos/docs/systems, or none]
- Do not write outside this boundary.

Adopt existing work
- Branches: [exact branch names, or none]
- Pull requests: [exact URLs and current stable heads, or none]
- Artifacts/state to preserve: [paths, issue links, generated outputs, or none]
- Treat these as the starting point; do not recreate completed work.

Ordered deliverables
1. [deliverable + acceptance evidence]
2. [deliverable + acceptance evidence]
3. [deliverable + acceptance evidence]

Dependencies and decision gates
- [deliverable] may start only after [observable gate].
- At [decision], [proceed rule or stop-and-report rule].
- If a required permission, artifact, or decision is missing, stop at `blocked` and report exactly what is needed.

Packaging/output shape
- Deliver as: [one PR | Graphite stack with named layers | sequenced independent PRs].
- Base/head/merge order: [exact contract].
- Required final artifacts: [PR URLs, commit ids, generated files, release/deploy evidence].

Quality and review bar
- Run: [exact tests, typecheck, build, generated-artifact checks, CI].
- Preserve: [compatibility/security/performance constraints].
- Captain owns iterative review while commits move.
- Pause for outside review only when [stable PR head or explicit review gate].
- After outside review, consume one consolidated finding set on this same thread and close it out.

Explicit non-goals
- [out-of-scope repository/API/refactor/deploy]
- [behavior that must not change]

Terminal handoff condition
- Do not return merely because code exists. Return when [all deliverables complete], [validation is green],
  [PR/artifact packaging matches the contract], and [remaining blockers/decisions are explicitly listed].
```

## Cross-thread handoff prompt

Use this as the input to the consumer thread after the producer reaches its terminal handoff condition.

```text
Cross-thread handoff: [producer outcome] → [consumer outcome]

Completed producer work
- Producer repository/context: [owner/repo]
- Completed PRs: [URLs, merge state, and merge order]
- Producer validation: [tests/CI/release/deploy evidence]

Immutable consumer input
- Exact input: [commit sha | merged ref | signed tag/release | deployed version | artifact digest]
- Do not consume a moving branch or unpinned artifact.

External start gate
- Consumer work may begin only when: [merge complete | release published | deployment healthy | artifact verified].
- Evidence: [URL, check, digest, or command output].
- If the gate is not satisfied, stop without writing consumer changes.

Consumer authority boundary
- Next Capy thread/context: [thread id or new-thread goal]
- Writable repositories: [owner/repo@base branch, ...]
- Read-only producer context: [exact refs/URLs only]
- Do not write back to the producer repository unless separately authorized.

Reproduction and provenance
- Generation/reproduction command: [copyable deterministic command]
- Inputs and versions: [schema/source/version/digest]
- Generated artifact path and provenance: [path + source ref + digest]

Decision record
- Accepted decisions: [decisions the consumer must preserve]
- Unresolved decisions: [owner + explicit stop/proceed gate]

Consumer deliverables and packaging
1. [deliverable + acceptance evidence]
2. [deliverable + acceptance evidence]
- Output shape: [one PR | stack | sequenced PRs]
- Required merge order: [producer before consumer; internal consumer order]

Non-goals
- [producer redesign or unrelated cleanup]
- [other repositories or deployment stages]

Required validation and terminal condition
- Run: [consumer tests/typecheck/build/integration/generated checks].
- Verify provenance with: [command/check].
- Return only after the start gate, merge order, validation, and packaging contract are satisfied; otherwise
  report the exact blocker and preserve the existing thread for steering.
```
