# 0001 — Record architecture decisions

**Status:** Accepted · 2026-06-20

## Context
This is a long-lived, multi-agent project (Architect, Backend, Frontend,
QA/Security). Decisions need to be discoverable so agents don't re-litigate them.

## Decision
Use lightweight ADRs, one decision per file, in `docs/adr/`. Each records
context, the decision, and consequences. Superseding ADRs link back.

## Consequences
- A durable, reviewable record of *why*, not just *what*.
- ADRs are the canonical reference in code comments and handoffs.
