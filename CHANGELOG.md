# Changelog

All notable changes to Bally's Dashboard are documented here.

## 0.2.8.1 — Relax Icon Pack Import UX

A UX/security polish for v0.2.8 import: accept the natural "just zip your icons"
layout without weakening any archive/asset protection. No DB change (no migration),
no Docker/deployment or auth change, SVG still rejected, no remote imports, no
bundled packs/logos. See `docs/adr/0015-user-icon-pack-import.md`.

### Added
- **Manifestless (flat) packs.** A `.zip` of PNG/WebP files now imports with **no
  `manifest.json`** required: files at the zip root (e.g. `truenas.png`) and/or
  under `assets/` are accepted, and a manifest is **synthesised from the
  filenames**. The strict `manifest.json` + `assets/` format still works exactly as
  before (a present `manifest.json` is authoritative).
- **Filename → icon derivation.** `truenas.png` → key `truenas`, label `TrueNAS`;
  `sonarr-4k.png` → `sonarr-4k` / `Sonarr 4K`; `nginx-proxy-manager.webp` →
  `nginx-proxy-manager` / `Nginx Proxy Manager`. Pack id/name derive from the
  uploaded `.zip` filename (or a generated `pack-xxxxxxxx` slug when unavailable).

### Changed
- **Per-icon size cap raised 512 KB → 2 MB** for pack assets (`MAX_PACK_ICON_BYTES`;
  the 512 KB custom-upload cap is unchanged). The ZIP stays capped at 5 MB.
- **Clearer picker copy:** "ZIP up to 5 MB · PNG/WebP only · each icon up to 2 MB",
  plus a hint that a `manifest.json` is optional.
- **Clearer import errors:** a non-image root file reports an "Unsupported file in
  pack…" message; the manifest-missing case is only an error when there are also no
  usable PNG/WebP files (`no_icons`); SVG reports a clear "not supported" message.

### Security (unchanged protections)
- Still rejects: SVG/JPEG/GIF/ICO (magic-byte sniff, PNG/WebP only), path traversal,
  absolute paths, backslashes, Windows drive letters, NUL bytes, symlinks/special
  files, nested archives, and any nested folder other than `assets/`. Root files
  other than PNG/WebP and `manifest.json` are still rejected.
- Duplicate filename-derived keys are **rejected with a clear message** (the safe,
  predictable choice — no silent renaming). Entry/zip/uncompressed caps unchanged.

## 0.2.8 — User Icon Pack Import

Opt-in, user-driven icon-pack import. Users upload a **local `.zip`** pack
(`manifest.json` + PNG/WebP assets), select pack icons in the picker through a new
**Packs** tab, and delete imported packs. Imported packs are treated as untrusted
input throughout. No bundled third-party packs, no brand logos in the repo, no
remote/URL importing, and SVG stays rejected. One additive migration; no
apps/`custom_icons`, Docker/deployment, or auth changes. See
`docs/adr/0015-user-icon-pack-import.md`.

### Added
- **`pack:<packId>/<iconKey>` icon reference** (plus optional `?v=<variant>`),
  parsed additively in `parseIconRef` alongside `builtin:`/`custom:`/URL refs and
  resolved to `mode:"img"` only (never a CSS mask). Invalid slugs or a
  missing/deleted pack/icon degrade to the initials fallback; a requested but
  absent variant falls back to the base icon.
- **Pack import pipeline** (`POST /api/icons/packs`, multipart `.zip`): zip-size
  cap (5 MB) before parsing; central-directory scan bounding entry count and
  rejecting symlinks/special files (and the zip64 entry-count sentinel); a
  `manifest.json` + `assets/`-only path allowlist; per-entry and total **declared**
  uncompressed caps (zip-bomb guard) plus per-asset **actual**-byte re-validation;
  magic-byte sniffing (PNG/WebP only — SVG/GIF/JPEG/ICO/empty/malformed rejected);
  512 KB/asset, 16 MB/pack; sha256 dedup; strict zod manifest schema (slug pack id
  / icon keys, unique keys, `assets/`-rooted safe file paths, http(s)-only
  display-only homepage). Imports are **atomic** — staged then committed; any
  failure persists nothing and cleans up staged files. Duplicate pack id → `409`.
- **API:** `GET /api/icons/packs` (list), `POST /api/icons/packs` (import),
  `DELETE /api/icons/packs/[packId]` (delete), and
  `GET /api/icons/packs/[packId]/[iconKey]/raw` (+ optional `?v=`) serving bytes by
  `(packId, key[, variant])` with the v0.2.6 safe headers (`nosniff`, inline,
  immutable). All wrapped in `protectedRoute` (auth + same-origin CSRF).
- **Packs tab** in the icon picker: import a `.zip`, browse imported packs grouped
  by pack with name/version/author/license and a display-only homepage link
  (`rel="noopener noreferrer"`, never fetched), select pack icons, and delete a
  pack. Existing **Library / Custom / URL / None** flows are unchanged.
- **`fflate`** (MIT, zero-dependency) for ZIP reading.
- Storage on the existing data volume under `<ICONS_DIR>/packs/<packId>/`, assets
  named by sha256; metadata in two new tables.

### Database
- One additive migration (`0004`) creating **`icon_packs`** and
  **`icon_pack_icons`** (FK `ON DELETE cascade`, unique `(pack_id, key, variant)`,
  indexes on `(pack_id, key)` and `sha256`). No change to `apps` or `custom_icons`.

### Notes
- No Docker/deployment or auth change. No third-party icon packs or brand logos
  bundled; no remote URL importing; SVG import remains rejected (PNG/WebP only).
  Deleting a pack does not rewrite app records — apps referencing a removed pack
  degrade to initials. Icon selection is **manual** (one at a time from the Packs
  tab). Deferred to later phases: **bulk icon-to-app matching** (planned as
  **v0.2.9 — Icon Pack App Matching**: a post-import review UI that *suggests*
  app↔icon matches and bulk-applies only user-confirmed selections — never
  auto-applied), pack-driven auto-suggestion (manifest `aliases`), and a pack
  replace/upgrade flow (re-import is delete-first today).

## 0.2.7 — Icon Alias Expansion & Generic Icon Set

Much broader icon auto-suggestion for common self-hosted apps, built entirely on
the v0.2.6 framework. Code + first-party assets only — no DB schema/migration,
API contract, Docker/deployment, or auth changes. See
`docs/adr/0014-icon-policy-and-pack-import.md`.

### Added
- **14 new first-party generic icon keys** (authored monochrome glyphs, rendered
  with `currentColor`, no third-party brand logos): `ai`, `proxy`, `identity`,
  `automation`, `camera`, `backup`, `notes`, `finance`, `rss`, `server`,
  `indexer`, `calendar`, `search`, `requests` — growing the built-in registry
  from 16 to 30 keys.
- **Large alias expansion** across existing and new keys, covering common media,
  downloader, indexer, reverse-proxy, DNS/VPN/security, identity/secrets,
  container/admin, monitoring, dev/Git/CI, database, storage/cloud/backup,
  notes/wiki, finance/RSS/search, AI/LLM, and home-automation/camera apps
  (~550 aliases total, each unique to one key).
- **4K / multi-instance handling** — `suggestIconKey` now strips standalone
  qualifier tokens (`4k`, `uhd`, `hd`, `anime`, `kids`, `instance`, `alt`, `2`,
  `3`, …) before matching, so `Sonarr 4K`, `Radarr Anime`, and `Sonarr 2` all
  suggest `media`. Never strips to empty; the suggester stays pure and returns a
  base key only (no `?v=4k`).

### Changed
- **Suggestion re-homing** so results match expectations: Uptime Kuma / Netdata /
  generic "monitoring" now map to `monitor` (were `chart`); Overseerr / Jellyseerr
  now map to the new `requests` key (were `media`).
- **Short-name bleed guard** — the weakest match signal now requires a ≥ 3-char
  residual, preventing short names from matching long aliases.

### Notes
- No DB migration, no apps-table change, no Docker/deployment/auth change, no
  third-party assets, no SVG uploads. Existing URL/custom/built-in icon
  references render unchanged. Icon-pack import (`pack:<id>/<key>`) remains
  designed-only (ADR 0014), not implemented.

## 0.2.6 — App Icon Library & Custom Icons

Apps can now use a proper icon — a first-party built-in glyph, an uploaded
custom image, or a remote URL — with a consistent renderer everywhere and a safe
initials fallback. Built on the existing `apps.icon` field; no apps-table change.
See `docs/adr/0013-app-icon-library.md`.

### Added
- **Built-in icon library** — a small, curated set of first-party *generic*
  glyphs (media, downloads, books, network/security, metrics, database,
  containers, home, cloud, storage, code, mail, music, photos, monitoring,
  generic). Monochrome SVGs rendered with `currentColor`, so they adapt to the
  active theme. No third-party brand assets are bundled.
- **Typed icon references** — `apps.icon` now understands `builtin:<key>`
  (and `builtin:<key>?v=<variant>`) and `custom:<id>`, alongside existing
  http(s) URLs. Empty/unknown values fall back to initials.
- **Icon picker in the app editor** — choose from the Library, a Custom upload,
  a URL, or None, with a live preview.
- **Custom icon uploads (PNG/WebP)** — upload an image (hard 512 KB cap); files
  are stored on the data volume and served by **opaque id only** (never a
  filesystem path). Identical uploads are de-duplicated by content hash.
- **Auto-suggest** — the picker offers a sensible built-in based on the app name
  / URL. It is only ever *offered* and never overwrites an explicit choice.
- **Shared `AppIcon` renderer** — launcher cards, Quick Launch and individual app
  widgets now use one icon path (URL/custom → `<img>`, built-in → themed glyph,
  otherwise initials), with graceful `onError` fallback to initials.

### Security
- Uploads are validated by **magic bytes** (not the client-declared type), size
  capped, and served with `X-Content-Type-Options: nosniff`, inline disposition
  and immutable caching. **User-uploaded SVG is intentionally not accepted** in
  this release (built-in first-party SVGs are reviewed repo assets).

### Notes
- One additive migration (`custom_icons` metadata table). The apps table, API
  contract for apps, and Docker/deployment are unchanged. Existing icon URLs keep
  working. With custom icons, the backup target is the whole data dir (icons live
  next to the SQLite file), configurable via `ICONS_DIR`.

## 0.2.5 — Dark Mode Select Readability Fix

### Fixed
- **Dark-mode Select dropdown** — the shared `Select` now sets `color-scheme` to
  follow the active theme and themes its options, so the native dropdown/option
  list is readable in dark mode (no more bright-white popup). CSS-only; affects
  all selects (including the dashboard editor's "Add app widget" pickers). No
  functional, API, schema, or Docker changes.

## 0.2.4 — Individual App Dashboard Widgets

Pin a specific app as its own homepage dashboard widget. Built on the existing
v0.2.2/v0.2.3 layout framework and editor — no DB schema, migration, API
contract, or deployment changes (see docs/adr/0012).

### Added
- **App widgets** — add an existing app as a standalone homepage widget. Each
  widget shows the app name, status (when health is enabled), category badge
  (where available), icon/initial and an Open button.
- **"Add an app widget" in the editor** — choose an app (active apps, hidden
  included, retired excluded) and a target section. Already-added apps are
  disabled — **one widget per app**. Adding only marks the layout dirty; nothing
  saves until **Save changes**.
- **Remove action** — instanceable widgets (app widgets) gain a **Remove** action,
  distinct from Hide: Hide keeps the widget in the layout (invisible in normal
  view); Remove deletes the instance entirely. Built-in widgets remain Hide-only.
- **Full editor parity** — app widgets show/hide, resize, reorder, move between
  sections, and round-trip through save/cancel/reset like built-in widgets.

### Changed
- **Widget contract gains `instanceable`** (`WidgetDefinition` / catalog /
  resolved widget). Instanceable widgets are known to the catalog so their
  instances survive reconcile, but are **never auto-placed** — excluded from the
  default layout and from reconcile's auto-append. The generic `app` widget is the
  first instanceable widget, contributed by the core module.
- **Server-side title enrichment** — the layout service fills app-widget titles
  from the apps table after resolving; `resolveLayout` stays pure (catalog-only).

### Notes
- **Resilient to missing apps.** Deleted/missing apps render a calm "unavailable"
  state (with guidance to remove the widget); retired apps render a muted state.
  Layouts never auto-drop an app widget for a temporarily-missing app — only
  structurally malformed instances (invalid `config.appId`) are dropped.
- **Safe defaults.** Default and Reset layouts contain no app widgets; no app is
  ever added automatically. App widgets store only `{ appId }` in widget config.
- **No persisted-document/API/schema change.** App widgets reuse the existing
  `dashboard_layouts` document and `GET`/`PUT`/`POST reset` endpoints.

## 0.2.3 — Custom Dashboard UI/UX

The user-facing editing experience for the v0.2.2 homepage layout framework. No
changes to the persisted document, API contract, schema, auth, or deployment —
this is purely the frontend editor built on the existing
`GET`/`PUT`/`POST reset` endpoints.

### Added
- **Customise mode** — a "Customise dashboard" entry on the homepage opens an
  in-page editor. Normal view mode is unchanged (still server-rendered) and gains
  only that one button.
- **Show / hide & restore** — toggle any widget's visibility. Hidden widgets stay
  in place (dimmed, with a "Hidden" badge and a "Show" action) so they are always
  recoverable; view mode filters them out.
- **Reorder** — move widgets within a section, and move whole sections, with
  up/down buttons (disabled at the ends). No drag-and-drop.
- **Resize** — per-widget size control (`small` / `medium` / `wide` / `full`),
  a segmented control on desktop and a Select on mobile.
- **Sections** — add a named section, rename (the default section may stay
  headingless; user sections require a name), move up/down, move widgets between
  sections via a "Move to section" Select, and delete a section **only when it is
  empty**.
- **Save / Cancel / Reset** — Save persists the whole layout in one `PUT`; Cancel
  discards (with a confirm when there are unsaved changes); Reset restores the
  default via the reset endpoint (with confirmation). A visible dirty indicator,
  inline saving/saved/error states, and a `beforeunload` guard protect unsaved work.
- **Accessible, mobile-friendly** — labelled controls and aria-labels, a
  focus-trapped `ConfirmDialog` (Escape/overlay to cancel, focus restored on
  close), a polite live region for action feedback, visible focus states, and a
  layout usable down to 360px.

### Notes
- **No persisted-document/API/schema change.** The editor maps the resolved layout
  to the existing config shape and relies on the server to validate, reconcile and
  normalise on save. Full App Router route-change interception is intentionally not
  added (covered by the dirty indicator + `beforeunload` + Cancel confirmation).

## 0.2.2 — Customisable Homepage Dashboard

This release lands the **backend/framework foundation** for a customisable
homepage dashboard. The interactive edit UI (show/hide, reorder, resize and
section controls) is a follow-up phase; everything here is the data model,
persistence and API it will drive. The default homepage is visually unchanged
until a layout is saved.

### Added
- **Versioned layout document** — the homepage is now a persisted, versioned
  layout config (`DashboardLayoutConfig`): an ordered list of **named sections**,
  each holding placed widgets with a width **size token** (`small` / `medium` /
  `wide` / `full` → 1–4 columns), an `order`, and a `hidden` flag. Hidden widgets
  stay in the document so they are always **restorable**.
- **Server widget catalog** — the authoritative list of available widgets is
  derived from the enabled modules' `WidgetDefinition`s (single source of truth),
  and drives both the default layout and config reconciliation.
- **Default layout builder** — reproduces the previous homepage exactly (single
  unnamed section; same widgets, order and sizes), so a fresh install looks
  identical. Future modules' widgets auto-appear (visible) in the first section.
- **Persistence + API** — a new `dashboard_layouts` table stores the layout as a
  JSON document. `GET /api/dashboard/layout` returns the resolved layout (or the
  default), `PUT /api/dashboard/layout` validates + reconciles + saves, and
  `POST /api/dashboard/layout/reset` restores the default. All same-origin (CSRF)
  and auth protected like the rest of the API.
- **Reconcile / fallback** — stored configs are validated and reconciled against
  the catalog: unknown/removed widgets are dropped, new ones appended, orders
  normalised. A missing, corrupt or invalid stored document falls back to the
  computed default rather than failing the homepage.

### Framework only (no UI yet)
- **Named sections** are first-class in the data model and validation (simple
  groups: id, title, order, widgets — no nesting/colours/icons/permissions). The
  UI exposes a single default section for now.
- **Templates** and **import/export** are represented in the data model only
  (the `dashboard_layouts.kind`/`name` columns and a versioned, portable document
  with a `migrateLayoutConfig` upgrader). No template picker, import/export, or
  drag-and-drop is implemented.

### Notes
- One new migration (`dashboard_layouts`). Single global layout only — no
  multi-user/auth changes. No Docker/deployment/port changes. See
  `docs/adr/0011-dashboard-layout-customisation.md`.

## 0.2.1 — Import Apps from Docker

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

## 0.2.0 — Docker Command Centre

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
