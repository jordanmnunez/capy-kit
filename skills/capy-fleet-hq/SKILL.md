---
name: capy-fleet-hq
description: Coordinate Capy threads with an organization-scoped key and the current Capy CLI.
allowed-tools: Bash(capy:*)
---

# Capy fleet HQ

The current public API is organization-key scoped but thread list/create calls require a known project ID. It cannot discover projects: run `capy init` to store named IDs and choose a primary, or pass `--project <configured-name-or-raw-id>`. List threads, then steer or interrupt root threads directly. Do not use legacy project-discovery/model APIs, `runState`, or legacy pagination.
