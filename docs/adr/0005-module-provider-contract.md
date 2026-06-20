# 0005 — Module / provider plugin contract

**Status:** Accepted · 2026-06-20

## Context
"Modular integrations" and "plugin architecture" must collapse into one concept
so optionality is uniform and there are no hardcoded assumptions about a user's
stack.

## Decision
A single `ModuleDefinition` (`src/modules/types.ts`) self-describes a module's
config schema (zod) and capabilities: `health`, `metrics`, `actions`, `widgets`.
A registry holds enabled modules; a disabled module contributes nothing. Core
built-ins (system metrics, app health) implement the *same* contract via an
always-on `core` module. Widgets reference client components by string key so the
registry stays server-safe (no React imports).

## Consequences
- v0.1 proves the seam with core providers only; v0.2's Docker module is the
  first *external* implementor with no contract change.
- `types.ts` and `registry.ts` are ⭐ Architect-owned; changes are versioned and
  broadcast to all agents.
- `actions` and `secretFields` are defined now but only exercised in v0.2.
