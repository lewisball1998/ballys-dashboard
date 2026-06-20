# Architecture Overview

Bally's Dashboard is a **single full-stack Next.js application**. It is
read-heavy and event-driven (a command centre, not a request-driven launcher),
so it is built around three engines plus a thin CRUD layer.

## Layers

```
Presentation   React Server + Client Components, Tailwind
API            Route Handlers (/app/api) + Server Actions
Domain         services: settings · apps · health · metrics · notifications
Engines        Module Registry │ Scheduler │ Event Pipeline
Integration    Module/provider contract + concrete modules (Docker = v0.2)
Data           Drizzle ORM → SQLite  (+ crypto for secrets, v0.2)
```

## The three engines

### 1. Module registry (`src/modules`)
The plugin system. A `ModuleDefinition` self-describes its config schema and
capabilities (`health`, `metrics`, `actions`, `widgets`). A disabled module
contributes nothing. In v0.1 only the **core** module registers (system metrics
+ app health) — proving the seam with in-tree code before Docker becomes the
first external module in v0.2. Contract: `src/modules/types.ts` (⭐ Architect-owned).

### 2. Scheduler / collection engine (`src/server/scheduler`)
In-process, single-instance, started once at boot via `instrumentation.ts` with
a `globalThis` singleton guard. Walks providers on per-job intervals, writes
results to the DB (so the UI reads fast, cached state), and exposes `runNow` for
on-demand "refresh". v0.1 jobs (added in Phase 1): system metrics, app health,
metric retention.

### 3. Event / notification pipeline (`src/server/events`)
Collectors emit typed events; the pipeline deduplicates (via `dedupeKey` + TTL)
and fans out to sinks. v0.1 sinks: console (now) + DB → `notifications` (Phase 1).
v0.1 event sources: app health transitions + CPU/RAM/storage threshold breaches.

## Cross-cutting

- **Guarded fetch (`src/server/http`)** — the single SSRF chokepoint. Every
  outbound request to a user-influenced URL routes through it (ADR 0006).
- **Crypto (`src/server/crypto`)** — AES-256-GCM secret encryption; scaffolded in
  v0.1, load-bearing in v0.2.
- **Settings (`settings` table)** — key/value store that makes the product fully
  UI-configurable with no config-file editing.

## Boot sequence (`src/instrumentation.ts`)
1. Run DB migrations (idempotent).
2. Register core modules.
3. Start the scheduler.

## Data model
See `src/db/schema/`. One generic `metrics` table serves all sources so a new
provider only emits points — no per-integration schema change.
