# 0017 — Infrastructure & Hardware Telemetry

**Status:** Accepted · 2026-06-22

Realises the "v0.3.0 — Infrastructure & Hardware Monitoring Expansion" work. The
Infrastructure page grows from a single container-visible system widget into a
monitoring centre: storage overview, drive inventory (temperature / SMART), pool
capacity, hardware metric cards (CPU, memory, GPU, network, storage, uptime) with
detail views, an alerts summary, and explicit telemetry source status — all
degrading gracefully when data is unavailable.

## Context

The dashboard already collects container-visible CPU/RAM/storage/network/uptime
via the core metric provider (ADR 0008) and stores it in the `metrics` table. The
gap was a richer, hardware-aware *view*: drive temperatures, per-interface
network, memory detail, capacity-by-pool, and a clear story for data that simply
is not visible from inside a container.

TrueNAS / SMART / ZFS pool integrations remain a **v0.4+** concern (roadmap), and
the brief forbids new external integrations, schema changes, shell execution, and
privileged escalation in this phase.

## Decision

### Read-only, local, server-side telemetry only

A new server-only abstraction under `src/server/telemetry/` reads **only** kernel
files (`/proc`, `/sys`) plus the **already-opt-in** Docker socket (ADR 0008). No
shell execution, no new mounts required, no schema change. Sources that need
privileged tooling (smartctl, zpool, nvidia-smi) are **not invoked**; they
degrade to a calm `unavailable` / `not_configured` state — never a fault.

- `proc.ts` — pure parsers + guarded readers for `/proc/meminfo`, `/proc/net/dev`,
  `/proc/mounts`.
- `sysfs.ts` — drive inventory (`/sys/block`), hwmon temperatures/power, thermal
  zones, best-effort amdgpu GPU via `/sys/class/drm`.
- `severity.ts` — pure severity classification (unit-tested).
- `redact.ts` — pure serial/path redaction (unit-tested).
- `container-stats.ts` — bounded, best-effort per-container CPU/mem via the
  existing Docker engine client (top consumers grouped by app, never host
  processes).
- `service.ts` — orchestrator → builds the normalised, redacted DTO, computes
  per-source status and real alerts. It never throws to the route.

### Severity model

`HealthSeverity = healthy | warning | critical | unavailable`. Temperature bands
are **<45 healthy / 45–54 warning / ≥55 critical** per the brief; capacity bands
default to the configured notification threshold (warning) and a higher critical
band. The golden rule: **unknown is `unavailable`, never critical** without real
failure evidence, so absent sensors never raise false alarms. Only `warning` /
`critical` conditions become alerts.

### Privacy / redaction

Nothing privileged reaches the client. Disk serials are partially masked
(`WD…4567`); free-text labels (drive models, GPU names) are stripped of anything
resembling a filesystem path and length-capped. Storage pools are labelled by
mountpoint **basename** only (`tank`, `root`) — never full host paths, device
nodes, the Docker socket path, or raw backend errors. SMART verdicts and pool
health labels are reported as `unavailable` (no privileged source in this phase).

### Transport

`GET /api/infrastructure` (`protectedRoute`, `force-dynamic`) returns a single
`InfrastructureTelemetryDTO`. CPU usage % and aggregate network rate reuse the
already-persisted `metrics` rows (`getLatestMetrics`); per-interface rates use an
in-process previous-sample cache (mirroring the core collector). Everything else
is read fresh per request. The client polls via `useInfrastructure`.

### UI

Modular, reusable client components under `src/components/infrastructure/`:
severity/source badges, an expandable `MetricCard`, source-status row, alerts
summary, storage overview (per-pool cards), drive inventory (responsive
table/cards), and the hardware metric cards. The home dashboard's
`system-overview` widget is **unchanged** — this is purely additive on the
`/infrastructure` route, and the page renders cleanly with limited
container-only metrics.

## Consequences

- v0.3.0 is code + tests + docs only: **no schema change, no migration, no new
  dependency**, no Docker/deployment or auth change, no new external integration.
- Works out of the box inside a plain container (basic metrics; deep hardware
  sensors and per-app usage light up when `/sys` and/or the Docker socket are
  available) — consistent with ADR 0008.
- The page is honest about provenance: TrueNAS shows `not_configured`, pointing at
  the v0.4+ integration without pretending the data exists.

### Deferred (future phases)

- **SMART verdicts + ZFS/pool health** via a privileged source (TrueNAS API or a
  read-only smartctl/zpool path) — surfaces in the already-built `smartStatus` /
  pool `health` fields once a provider exists.
- **NVIDIA GPU** telemetry (needs the proprietary tooling/sysfs).
- **Power** beyond GPU/package draw (UPS / smart-plug integrations).
