# Bally's Dashboard

A homelab **infrastructure command centre** — not just an app launcher.
Dashboard-first, modular, single-container, self-hosted.

> **Status: Phase 0 (Foundations).** The scaffold, contracts, and engine
> skeletons are in place. Feature UI begins in Phase 1. See
> [`docs/roadmap.md`](docs/roadmap.md).

## Stack

- Next.js (App Router) + TypeScript
- TailwindCSS v4
- SQLite + Drizzle ORM
- Single Docker-deployed app (amd64 primary, arm64 supported)

## Architecture at a glance

Three engines plus a thin CRUD layer (see [`docs/architecture/overview.md`](docs/architecture/overview.md)):

1. **Module registry** — the plugin system; everything optional plugs in here.
2. **Scheduler / collection engine** — background polling, runs with no browser open.
3. **Event / notification pipeline** — turns state changes into persistent notifications.

Decisions are recorded as ADRs in [`docs/adr/`](docs/adr/).

## Local development

This project uses **pnpm** (via Corepack — no global install needed):

```bash
corepack enable                 # one-time, enables pnpm
pnpm install                    # install dependencies (creates pnpm-lock.yaml)
cp .env.example .env            # optional; sensible defaults are built in
pnpm db:generate                # generate the initial migration from the schema
pnpm db:migrate                 # apply migrations (also runs automatically at boot)
pnpm dev                        # http://localhost:3000
```

Useful checks:

```bash
pnpm typecheck                  # tsc --noEmit
pnpm lint                       # eslint
pnpm test                       # vitest
pnpm build                      # production (standalone) build
```

## Docker

```bash
docker compose up --build       # builds and runs on http://localhost:3000
```

Data (SQLite db + uploaded icons) persists in `./data`. The Docker socket is
**not** mounted in v0.1 — container management arrives with the v0.2 Docker
module and is opt-in (see [`docs/adr/0008-container-metrics-and-docker-socket.md`](docs/adr/0008-container-metrics-and-docker-socket.md)).

## Configuration

All product configuration (dashboard name, theme, timezone, apps, intervals,
thresholds) is managed **in the UI** and stored in SQLite. No config-file
editing is required for normal use. Environment variables only cover
deployment-level concerns — see [`.env.example`](.env.example).
