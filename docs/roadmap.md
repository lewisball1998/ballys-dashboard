# Roadmap

The architecture is fixed across all releases; only *integrations* phase in. The
dashboard must always be fully usable with **zero integrations enabled**.

## v0.1 — Core usable dashboard
App shell · trimmed setup wizard (appearance + apps) · name/theme/timezone
settings · app launcher (categories, add/edit/delete, icons, favourites,
hide/disable/retire) · basic app health checks · local CPU/RAM/storage/network/
uptime widgets · persistent notification centre · settings page · SQLite/Drizzle
· Docker deployment skeleton · optional single-user auth. **No config editing.**

Build phases:
- **P0 Foundations** (Architect, solo) — scaffold, contracts, schema, engines skeleton, Docker skeleton. ← *this phase*
- **P1 Core platform** (BE ∥ FE) — scheduler jobs + system collector + settings API; shell, nav, theme, default grid.
- **P2 Launcher** (BE ∥ FE) — apps/categories CRUD + icons + health engine; launcher UI + lifecycle.
- **P3 Monitoring + notifications** (BE ∥ FE) — metrics storage/retention + notification pipeline DB sink; system widgets + notification centre.
- **P4 Wizard + settings + harden** (QA lead) — 3-step wizard, settings page, SSRF/CSRF/auth review → **v0.1 release**.

## v0.2 — Docker command centre
First full reference module: `modules` table + encrypted instance config; opt-in
Docker socket (documented privileged); container list/status/uptime; safe
start/stop/restart; Docker widgets; CSRF on actions; full secret encryption;
environment-discovery returns to the wizard.

## v0.3 — Infrastructure & hardware monitoring
v0.3.0 expands the Infrastructure page into a hardware monitoring centre:
server-side, read-only local telemetry (`/proc`, `/sys`) + opt-in Docker
container stats; storage overview, drive inventory (temperature / SMART where
available), pool capacity; CPU/memory/GPU/network/storage/uptime cards with
detail views; severity states (healthy/warning/critical/unavailable); an alerts
summary; and explicit telemetry source status. No new external integrations,
schema changes, or shell execution. See `docs/adr/0017`.

v0.3.1 is a display-only polish pass: invalid CPU clock / metric values render as
`—` (not `0 MHz`), container/internal mounts are filtered out of storage, the app
data volume is labelled as app storage (not a NAS pool), first load shows a calm
skeleton, and telemetry-source copy is clearer. A read-only TrueNAS provider for
real NAS pool/dataset/SMART health remains future work. See
`docs/plans/v0.3.1-infrastructure-polish.md`.

## v0.3.x — Notes, reminders & polish
Notes; manual + domain/cert/backup reminders; widget drag/resize layout;
import/export; mobile responsiveness; PWA prep.

## v0.4+ — Storage & integrations
TrueNAS · Unraid · Portainer · Home Assistant · Plex/Jellyfin · Arr · Tailscale,
then Ollama/Open WebUI/AnythingLLM. Each is just another `ModuleDefinition`;
none required.
