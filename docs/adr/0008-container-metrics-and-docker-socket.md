# 0008 — Container-visible metrics; opt-in Docker socket

**Status:** Accepted · 2026-06-20

## Context
Running inside Docker, the app sees cgroup-limited CPU/RAM and only mounted
filesystems/interfaces. Container management (v0.2) requires the Docker socket,
which grants root-equivalent control of the host.

## Decision
- **Metrics (v0.1):** report container-visible stats by default, clearly
  labelled. Richer host-level metrics require optional read-only mounts
  (`/proc`, `/sys`, host paths) which are documented, not required.
- **Docker socket (v0.2):** NOT mounted in v0.1. When the Docker module ships it
  is opt-in, mounted read-only where possible, and surfaced in the UI/docs as a
  privileged escalation. All container actions are POST + CSRF-protected.

## Consequences
- v0.1 works out of the box with no privileged mounts.
- The biggest privilege escalation (socket) is deferred and gated behind explicit
  user opt-in with clear warnings.
