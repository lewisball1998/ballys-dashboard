# 0018 — TrueNAS Read-only Telemetry Provider

**Status:** Accepted · 2026-06-22

Realises the "v0.3.2 — TrueNAS Read-only Telemetry Provider" work: an optional,
read-only TrueNAS provider behind the existing v0.3.0 telemetry abstraction
(ADR 0017) that enriches the Infrastructure page with real NAS pool, dataset,
disk, temperature and SMART-style health data **where available** — while keeping
app/container storage clearly separate and the page fully usable when TrueNAS is
not configured.

## Context

ADR 0017 deliberately deferred NAS pool / SMART / ZFS health to "a future
release", since those need a source beyond local `/proc` + `/sys`. TrueNAS is the
first such source. The constraints for this phase: **read-only**, optional, no new
external write surface, no schema change, no Docker/Dockerfile change, no shell
execution, and the page must never break or false-alarm when TrueNAS is absent,
slow, or on an unexpected version.

TrueNAS API compatibility has shifted across versions. The legacy `/api/v2.0` REST
routes are deprecated; the current TrueNAS SCALE middleware exposes a **JSON-RPC
2.0 API over a WebSocket** at `/api/current`. The provider must prefer the current
mechanism and fail gracefully on older versions.

## Decision

### A focused, server-only provider module

`src/server/telemetry/truenas/` (server-only, never bundled to the client):

- `types.ts` — strict, permissive raw shapes + the normalised result type.
- `ws-client.ts` — a tiny **hand-rolled WebSocket client over `node:tls`/`node:net`**
  (RFC 6455 framing, masking, ping/pong, handshake, timeouts).
- `client.ts` — JSON-RPC 2.0 client: `auth.login_with_api_key`, concurrent
  `call(method, params)` with per-call timeouts. Only read-only methods are issued.
- `normalise.ts` — **pure** normalisers (capacity parsing, severity mapping, serial
  masking, dataset/disk/SMART normalisation). The heavily unit-tested surface.
- `provider.ts` — orchestrator: reads env, connects, queries best-effort within an
  overall budget, normalises, and returns a calm result. **Never throws.**

The `service.ts` orchestrator calls the provider alongside the existing local +
Docker sources (in the same `Promise.all`), drives the `truenas` source entry from
the real result, and attaches an optional `storage.nas` block.

### Hand-rolled WebSocket over `node:tls` (not the global `WebSocket`)

TrueNAS's current API is WebSocket JSON-RPC. Node's global (undici) `WebSocket`
cannot be given **per-connection** TLS options without adding the `undici`
dependency. Speaking the framing directly over `node:tls` keeps the project
dependency-free (mirroring the Docker engine client over `node:http`, ADR 0008)
and — critically — lets us **verify certificates by default** while scoping any
opt-in verification bypass to the TrueNAS connection alone.

### TLS: verify by default, explicit opt-in bypass only

- Certificates are verified by default (`rejectUnauthorized: true`).
- `TRUENAS_ALLOW_INSECURE=true` is the **only** way to skip verification (for
  self-signed / trusted-local homelab installs); unset is treated as `false`.
- The bypass affects **only** the TrueNAS connection. We do **not** use
  `NODE_TLS_REJECT_UNAUTHORIZED` and do **not** weaken global TLS.

### DTO integration that keeps NAS and local storage separate

`StorageTelemetryDTO` gains `nas: NasTelemetryDTO | null`:
- `null` when TrueNAS is **not configured** → the page is byte-for-byte the same as
  a no-NAS deployment.
- otherwise a block with the source `status`, a severity rollup, and NAS `pools` /
  `datasets` / `disks` (disks reuse the existing `DriveDTO`, with SMART/temperature
  populated and serials masked via the existing `redactSerial`).

Local container-visible filesystems (`storage.pools`) and `/sys` drives
(`storage.drives`) are unchanged, so NAS and app/container storage never conflate.

### Severity, privacy, and "never throw"

- Pool `ONLINE`/healthy → healthy; `DEGRADED`/unhealthy → warning;
  `FAULTED`/`UNAVAIL`/`REMOVED` → critical; unknown → **unavailable**.
- SMART passed/failing map straight through; in-progress/unknown → **unavailable**.
  Missing telemetry is never a false critical.
- Temperatures reuse the existing bands (<45 / 45–54 / ≥55 °C).
- Status mapping: env missing → `not_configured`; unreachable / bad URL / TLS /
  protocol failure → `unavailable`; auth failure → `unavailable` with an
  "authentication failed" detail (no new enum value, no raw error text); core read
  ok but something missing → `partial`; all good → `available`.
- Bounded by per-call timeouts plus an overall wall-clock budget, so a hanging NAS
  cannot stall the Infrastructure page.

## Out of scope (unchanged from the brief)

No write actions, pool/dataset/disk management, SMART test or scrub triggers, alert
acknowledgement, shell commands, host filesystem browsing, smartctl shell provider,
Docker/Dockerfile changes, data-volume permission fix, schema changes,
auth/multi-user, AI, notes, or dashboard customisation.

## Consequences

- The Infrastructure page gains real NAS visibility for TrueNAS users with zero
  impact on users who don't configure it.
- The provider is resilient to TrueNAS version drift (defensive parsing, partial
  results) and to slowness (timeouts + budget).
- A small hand-rolled WebSocket client is now maintained in-tree; its scope is
  intentionally minimal and it degrades to `unavailable` on anything unexpected.
- Adding NAS *management* (writes) remains a deliberate non-goal and a later,
  separately-reviewed concern (roadmap v0.4+).
