# 0002 — Full-stack Next.js monolith (no microservices)

**Status:** Accepted · 2026-06-20

## Context
The product targets self-hosters who want a single, easy-to-run container. The
explicit optimisation target is maintainability and rapid development, not
service separation.

## Decision
Build one Next.js (App Router) + TypeScript application. API via Route Handlers
and Server Actions in the same codebase. No separate backend service.

## Consequences
- Single deployable, single build, shared types end-to-end.
- Background work needs an in-process solution (see ADR 0004).
- Horizontal scaling is constrained — acceptable for a homelab tool; documented
  as out of scope for v1.
