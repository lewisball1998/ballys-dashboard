# 0004 — In-process scheduler via instrumentation

**Status:** Accepted · 2026-06-20

## Context
A command centre must poll infrastructure and run health checks whether or not a
browser is open. The monolith decision (ADR 0002) rules out a separate worker
service for v1.

## Decision
Run an in-process scheduler started once from `instrumentation.ts` (Node runtime
only), guarded by a `globalThis` singleton so it survives Next.js module
re-evaluation and dev hot-reload. Jobs have intervals, per-run timeouts (via
`AbortSignal`), and overlap prevention. Results are written to the DB; the UI
reads cached state and can trigger `runNow`.

## Consequences
- Simple, single-container operation; no external scheduler/queue.
- Assumes a single running instance. Multi-instance deploys would double-run
  jobs — explicitly out of scope for v1. Mitigation if needed later: a DB
  advisory lock / leader election.
