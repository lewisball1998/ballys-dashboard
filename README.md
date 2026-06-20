# Bally's Dashboard

A homelab **infrastructure command centre** — not just an app launcher.
Dashboard-first, modular, single-container, self-hosted.

> **Status: v0.1.** Core platform, app launcher, notification centre, first-run
> setup wizard, and optional single-user auth. See [`docs/roadmap.md`](docs/roadmap.md)
> and [`CHANGELOG.md`](CHANGELOG.md).

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

Decisions are recorded as ADRs in [`docs/adr/`](docs/adr/); the API contract is in
[`docs/architecture/api-contract.md`](docs/architecture/api-contract.md).

## Quick start (Docker Compose)

```bash
docker compose up --build       # builds + runs on http://localhost:3000
```

Then open <http://localhost:3000> — you'll be guided through the first-run setup
wizard. All data persists in `./data` (see [Backup & restore](#backup--restore)).

## First-run setup

The wizard runs on first launch and gets you to a working dashboard in minutes,
with no config-file editing:

1. **Appearance** — dashboard name, theme (light/dark/system), accent colour, timezone, optional logo URL.
2. **Starter template** — create generic categories (Media, Infrastructure, Automation, AI, Utilities) or start blank. Apps are added later from the Apps page.
3. **Authentication** — create an admin login, **or** skip auth (see below).
4. **Finish** — applies your settings and opens the dashboard.

If you skip the wizard, the dashboard is still fully usable; a banner links you
back to setup.

## Authentication

Optional **single admin user** (no multi-user/RBAC in v0.1).

- **Create an admin login** during setup → username + password are required to
  access the dashboard. Passwords are hashed with scrypt; sessions are cookie-based.
- **Skip auth** → the dashboard is open. **Only do this behind Tailscale, a VPN,
  or a trusted reverse proxy.** A Tailscale tailnet is the recommended way to
  reach the dashboard remotely.
- **Login/logout** — `/login` signs you in; the top-bar control signs you out.
- **Secure cookies** — session cookies are marked `Secure` automatically when the
  request is HTTPS (e.g. behind a TLS reverse proxy). On plain-HTTP LAN they are
  not `Secure` (so login works), which is why a VPN/proxy is recommended for
  remote access.
- **CSRF** — all mutating requests are same-origin checked; this applies even when
  auth is skipped.

### Recovery if locked out

Set `AUTH_DISABLE=1` in the environment and restart. This bypasses auth (CSRF
still applies) so you can reach Settings, fix or recreate the admin, then unset
it. In Compose, uncomment `AUTH_DISABLE: "1"` under `environment:`.

## Health & readiness

- `GET /api/health` — lightweight **liveness** (process up; no DB). Public.
- `GET /api/health/ready` — **readiness** (DB reachable + migrated → `200`, else `503`). Public.
- The Docker `HEALTHCHECK` uses **readiness**, so the container is only "healthy"
  once the database is up.

## Data persistence

Everything (settings, apps, categories, notifications, sessions) lives in a single
SQLite database at `DATABASE_PATH` (default `/app/data/ballys.db` in Docker),
inside the mounted `./data` volume. It survives container restarts and recreation.

### Backup & restore

The `./data` volume is the single source of truth — back it up to back up the app.

```bash
docker compose down                       # optional: stop for a consistent copy
cp -r ./data ./data-backup-$(date +%F)    # backup
# restore: stop, replace ./data with a backup, start again
docker compose up -d
```

## Local development

This project uses **pnpm** (via Corepack — no global install needed):

```bash
corepack enable                 # one-time
pnpm install                    # dependencies (creates pnpm-lock.yaml)
cp .env.example .env            # optional; sensible defaults are built in
pnpm db:generate                # generate the initial migration from the schema
pnpm db:migrate                 # apply migrations (also runs automatically at boot)
pnpm dev                        # http://localhost:3000 (Turbopack)
```

Checks:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Production deployment notes

- **Single container, non-root**, hardened Compose (`no-new-privileges`, `cap_drop: ALL`,
  `init`, `tmpfs /tmp`). See [`docker-compose.yml`](docker-compose.yml).
- Build a clean production image (`docker compose up --build`); never run a dev
  `.next` in production.
- For remote access, front it with **Tailscale** or a TLS reverse proxy and keep
  auth **enabled**.
- The Docker socket is **not** mounted in v0.1 (container management is v0.2 and opt-in).
- Multi-arch: amd64 is the primary/tested target; arm64 builds from the same Dockerfile.

## Configuration

All product configuration (dashboard name, theme, timezone, apps, intervals,
thresholds, auth on/off) is managed **in the UI** and stored in SQLite. No
config-file editing is required for normal use. Environment variables only cover
deployment-level concerns — see [`.env.example`](.env.example).

## v0.1 deferrals

The following are intentionally **not** in v0.1 (see the roadmap):

- Docker module / container controls (v0.2)
- Notes & reminders (v0.3)
- TrueNAS / Unraid / Portainer / Home Assistant / Plex / Jellyfin / Arr / Tailscale integrations (v0.4+)
- AI integrations (Ollama / Open WebUI / AnythingLLM)
- Advanced theming, drag-and-drop layout customisation, import/export
- Multi-user accounts / RBAC / SSO
- Secret-at-rest encryption rollout (`APP_ENCRYPTION_KEY` becomes load-bearing in v0.2)
