# 0009 — Multi-arch image, amd64-first

**Status:** Accepted · 2026-06-20

## Context
Homelabs run on x86 servers and ARM SBCs (Raspberry Pi, etc.). Q10 asked for
multi-arch if it doesn't slow initial work, else amd64-first with arm64 as a
follow-up.

## Decision
Use a `node:22-bookworm-slim` (glibc) base so `better-sqlite3` installs from
prebuilt binaries on both `linux/amd64` and `linux/arm64` — no compiler in the
image. The single `Dockerfile` is arch-agnostic; amd64 is the primary/tested
target. Publishing a multi-arch manifest via `docker buildx --platform
linux/amd64,linux/arm64` is a CI follow-up, not a code change.

## Consequences
- No friction now: one Dockerfile builds for both arches.
- arm64 is buildable immediately; only multi-arch *publishing* is deferred to CI.
- Chose Debian slim over Alpine to avoid musl build issues with the native sqlite
  module.
