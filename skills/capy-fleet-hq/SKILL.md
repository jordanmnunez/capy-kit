---
name: capy-fleet-hq
description: Coordinate Capy threads using configured project IDs and the current Capy CLI.
allowed-tools: Bash(capy:*)
---

# Capy fleet HQ

The current public API is project-ID scoped and does not provide project discovery. Keep a project ID in configuration, list its threads, and steer or interrupt root threads directly. Do not use legacy project/model APIs, `runState`, or legacy pagination.
