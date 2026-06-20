# Changelog

All notable changes to Bally's Dashboard are documented here.

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

- **v0.2** — Docker module / container controls (opt-in privileged socket);
  secret-at-rest encryption (`APP_ENCRYPTION_KEY`) becomes load-bearing.
- **v0.3** — notes & reminders; widget drag-and-drop layout; import/export.
- **v0.4+** — TrueNAS / Unraid / Portainer / Home Assistant / Plex / Jellyfin /
  Arr / Tailscale integrations, then AI (Ollama / Open WebUI / AnythingLLM).
- **Later** — multi-user accounts / RBAC / SSO; advanced theming.
