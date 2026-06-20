# Changelog

All notable changes to Bally's Dashboard are documented here.

## 0.2.1 — Import Apps from Docker (unreleased)

### Added
- **Import from Docker** — a new **Import from Docker** button on the Apps page
  (`/apps/import`) that turns detected containers into launcher entries. It
  reuses the v0.2.0 Docker read path and adds **no** new Docker capability — it
  only reads container metadata and creates apps.
- **Selective, never-automatic flow** — containers are shown as import candidates
  with read-only hints (name, image, state, health, ports, compose
  project/service). Nothing is selected by default; you pick candidates (or
  "Select all"), edit each one's **name, URL, health URL, category, favourite,
  health-checks, and trusted-internal TLS**, see a **review step**, and apps are
  only created after you confirm. A result summary reports imported / skipped /
  failed.
- **Server suggestions (just hints)** — a suggested app name and a suggested URL
  from a published port (using `localhost`, clearly editable; blank when no clear
  port). Reuses the existing app-create validation, so a valid `http(s)` URL is
  required to import.
- **Safety hints** — likely database/infrastructure/helper containers are flagged
  "Likely internal service" (never hidden), and apps that match an existing app
  by URL or name are flagged and **skipped** rather than silently duplicated
  (against existing apps and within the same batch).

### Changed
- **Smarter URL suggestions** — the importer no longer defaults URLs to
  `localhost`. The App URL is built from clear parts: **scheme** (https for host
  port 443, else http), an editable **Docker host / base address** defaulted from
  the hostname you opened the dashboard with, and a **published port** you pick
  when several exist — or a **Custom URL** for reverse-proxy addresses. `0.0.0.0`
  and `::` are treated as "published on the Docker host"; a `127.0.0.1`-only
  binding, or a loopback dashboard hostname, raises a clear warning. The Health
  URL defaults to the App URL. A non-sensitive port `hostScope` (all / loopback /
  specific) is now surfaced (the raw host IP is still never exposed).
- **Import from setup** — the setup wizard's apps step now offers **Import from
  Docker** (reusing the same flow, embedded), alongside manual setup and skip;
  shows a helpful message when Docker access isn't enabled.

### Notes
- **No DB schema change.** Duplicate detection is by name/URL only; the source
  container id is not persisted on the app. No destructive/bulk operations were
  added — imported apps are managed through the normal Apps flow.

## 0.2.0 — Docker Command Centre (unreleased)

### Added
- **Docker Command Centre** — a new **Docker** page that lists your containers
  grouped by Compose project, with state, health (when a `HEALTHCHECK` exists),
  published ports, compose service, and created/status. A summary strip shows
  running / stopped / restarting / unhealthy counts.
- **Safe lifecycle actions** — start, stop, and restart containers. Stop and
  restart require an explicit in-card confirmation. Container ids are validated
  (`^[a-f0-9]{12,64}$`) before any action; all actions are POST + same-origin
  (CSRF) protected and respect auth.
- **Server-side Docker client** — talks to the Docker Engine API over the unix
  socket using Node's built-in HTTP client (no third-party Docker dependency, no
  shell execution). Only a safe subset of fields reaches the browser; the socket
  is the single privileged choke point.
- **Clear unavailable/error states** — not configured, permission denied,
  unreachable, error, and empty are all handled with actionable guidance instead
  of a raw failure.
- **Docs** — `docs/DOCKER.md` covers enabling the (opt-in, privileged) Docker
  socket, the safer socket-proxy alternative, and the safety limits;
  `DOCKER_SOCKET_PATH` is documented in `.env.example` and `docker-compose.yml`.

### Security notes
- The Docker socket is **opt-in and off by default** (ADR 0008): mounting it
  grants root-equivalent host control. A read-only mount is sufficient. No
  exec/terminal, image/volume/network, or Compose-stack operations are exposed —
  only start/stop/restart.

## 0.1.1 — Docker host-binding fix

### Fixed
- **Container networking** — the Next.js standalone server now binds to
  `0.0.0.0` in Docker. Previously Docker set `HOSTNAME` to the container id, so
  the server never listened on a reachable address: the Docker healthcheck failed
  and host requests to the mapped port were refused/reset. Fixed by setting
  `HOSTNAME=0.0.0.0` in the Dockerfile (so `docker run`/k8s are correct too) and
  explicitly in `docker-compose.yml`. `PORT` stays the internal container port
  (3000); map it on the host via `ports:`.

## 0.1.0 — Core usable dashboard

First usable release. A homelab infrastructure command centre that works with
**zero integrations enabled** and is fully configurable through the UI (no
config-file editing).

### Added
- **Core platform** — app shell (sidebar + top bar), light/dark/system theme with
  accent colours, SQLite + Drizzle persistence, in-process scheduler, event
  pipeline, and a default dashboard widget grid.
- **Infrastructure monitoring** — container-visible CPU / RAM / storage / network /
  uptime via `/api/metrics`, with retention and a live System widget.
- **App launcher** — categories and apps CRUD, icons (URL/value), favourites,
  reordering, and the hide / disable-health / retire lifecycle. Basic app health
  checks via a guarded (SSRF-aware) fetch wrapper, with uptime stats.
- **Notification centre** — persistent, deduplicated notifications from app
  health transitions (down/recovered) and CPU/RAM/storage threshold
  breach/recovery; filters, read/dismiss/clear, a top-bar unread bell, and a
  dashboard summary widget.
- **First-run setup wizard** — appearance, generic starter templates
  (categories-only), an auth step, and finish; reachable working dashboard in
  minutes.
- **Optional single-user auth** — scrypt password hashing, cookie sessions
  (sha256-at-rest, 30-day sliding expiry), login/logout, on-by-default but
  skippable for trusted networks; `AUTH_DISABLE=1` recovery.
- **CSRF** — same-origin enforcement on all mutating routes.
- **Readiness** — `/api/health/ready` (DB) alongside `/api/health` (liveness);
  Docker healthcheck uses readiness.
- **Deployment** — single-container, non-root image; hardened Compose
  (`no-new-privileges`, `cap_drop: ALL`, `init`, `tmpfs /tmp`); single persistent
  `./data` volume; multi-arch (amd64 primary, arm64).

### Security notes
- Single admin only; passwords + session tokens hashed at rest; no secrets
  returned to the client. Recommended remote access is via Tailscale/VPN or a TLS
  reverse proxy with auth enabled.

## Deferred (planned)

- **v0.2.1 (proposed)** — "Import from Docker": discover running containers and
  selectively import them into the Apps launcher (confirming URL, category,
  favourite, and health check per app). Secret-at-rest encryption
  (`APP_ENCRYPTION_KEY`) becomes load-bearing once modules store credentials.
- **v0.3** — notes & reminders; widget drag-and-drop layout; import/export.
- **v0.4+** — TrueNAS / Unraid / Portainer / Home Assistant / Plex / Jellyfin /
  Arr / Tailscale integrations, then AI (Ollama / Open WebUI / AnythingLLM).
- **Later** — multi-user accounts / RBAC / SSO; advanced theming.
