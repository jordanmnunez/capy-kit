---
name: capy-fleet-hq
description: Coordinate Capy campaign ownership, handoffs, inspection triggers, and evidence-driven steering through the current Capy CLI.
allowed-tools: Bash(capy:*)
---

# Capy Fleet HQ

Use this higher-level workflow when work may span several outcomes, threads, or repository authority
boundaries. Fleet HQ chooses ownership and records handoffs; it is not a polling supervisor. Once a
Captain accepts a coherent campaign, yield until a declared trigger or materially changed fact
justifies inspection.

The API is organization-key scoped, but thread list/create calls require a known project ID. Use a
configured project or named profile; project discovery is not public.

## Keep the boundary clear

- Captain owns planning, implementation, testing, internal task ordering, and iteration inside each
  root thread.
- HQ owns goal boundaries, authority selection, dependencies between authorities, terminal evidence,
  and changed facts supplied after handoff.
- Task trees are read-only observation. Redirect work through the root thread.
- Usage can inform a human scope discussion; it never creates an automatic stop, retry, or quality rule.
- A Capy state is not a GitHub, CI, review, merge, deployment, or shipping receipt.

## Choose the ownership shape

- One bounded outcome in one authority boundary → one thread.
- One ordered campaign in one authority boundary → one Captain with the complete ordered queue.
- Independent outcomes that can progress without shared decisions → separate threads.
- A different repository/project authority boundary → a new thread with a formal, immutable handoff.

Dependency-linked work does not automatically belong locally. Keep it with one Captain when the
campaign is coherent and remains within that Captain's writable authority. Split only at genuine
ownership boundaries or where outcomes are independently reviewable and executable.

## Orient before dispatch

1. List relevant project work: `capy threads list --project <name> --json`.
2. Inspect likely owners before creating a duplicate: `capy threads messages <thread> --json` and
   `capy threads tasks <thread> --json`.
3. Decide whether this is one outcome, one ordered campaign, independent outcomes, or a cross-boundary
   handoff.
4. For a new thread, use a caller-stable request ID and the campaign template in
   `references/campaign-handoff.md`. Name authority, existing work to adopt, ordered outcomes,
   packaging, acceptance evidence, non-goals, and real decision gates.

## Record the delegation receipt, then yield

After dispatch, record:

- the owning thread ID and canonical URL;
- its writable authority boundary;
- the accepted terminal condition and required evidence;
- the next legitimate inspection trigger.

Do not keep polling merely because the thread is active. Legitimate triggers include:

- Capy requests user input or reports an error;
- the thread enters a settling state;
- a declared dependency gate becomes true;
- a stable pull-request head or other promised artifact exists;
- CI/review state changes in its owning system;
- the user supplies new evidence or changes the goal.

## Steer only on changed truth

Before sending a message, identify the material fact that changed and confirm the existing root thread
still owns the work. Consolidate related feedback into one steering message:

```bash
capy threads message <thread> '<changed fact, impact, and revised constraint>' --delivery steer --json
```

Ordinary progress, silence between milestones, or a desire for reassurance is not a steering reason.
Review stable artifacts rather than dripping findings into moving commits.

## Keep lifecycle predicates separate

| Predicate | Owning evidence |
| --- | --- |
| Thread active, waiting, idle, or ready for review | Capy thread fields |
| Task or pull request exists | Capy structured fields or GitHub |
| Checks are green | GitHub checks |
| Review is approved | GitHub review state |
| Change is merged | GitHub merge state |
| Change is deployed | Deployment system |
| Outcome is shipped | Customer-visible evidence |

Report the strongest supported state without inferring later lifecycle transitions. Use Capy's review
endpoint only at a stable PR head or when the user explicitly asks; it is a review round, not an HQ
approval gate.

Do not add fleet loops, automatic retries, readiness decisions, or quality gates to the faithful CLI.
