# API Contract — Phase 1 (v0.1 core platform)

This is the published contract Backend and Frontend build against in parallel.
DTOs live in `src/lib/types`, request schemas in `src/lib/validation`. ⭐
Architect-owned — changes here are versioned and broadcast.

## Conventions

- **Envelope:** every response is `ApiResponse<T>` — `{ ok: true, data }` or
  `{ ok: false, error: { code, message, fields? } }`.
- **Lists:** return `ListResult<T>` = `{ items, total }` inside the envelope.
- **Timestamps:** ISO 8601 UTC strings in all DTOs (never Date over the wire).
- **Validation:** request bodies/queries are parsed with the named zod schema;
  failures return `400` with `code: "validation_error"` and `fields` from
  `flatten()`.
- **Mutations (CSRF):** the `route()` wrapper same-origin-checks every
  `POST`/`PATCH`/`DELETE` — cross-origin → `403 csrf_failed`.
- **Auth:** `protectedRoute()` returns `401 unauthenticated` when auth is *active*
  (enabled in settings + an admin exists + not `AUTH_DISABLE`); passes through when
  inactive (CSRF still applies). Public: `GET /api/health`, `GET /api/health/ready`,
  `/api/auth/*`, `GET /api/setup/status`, and `/api/setup/seed|complete` **only while
  `!setupCompleted`** (auth-gated once complete).
- **Errors:** `400` validation, `401` unauthenticated, `403` csrf_failed,
  `404` not_found, `409` conflict, `500` internal, `503` not_ready.

## Endpoints

### Settings
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/settings` | — | `AppSettingsDTO` | structured view of the kv store |
| PATCH | `/api/settings` | `settingsUpdateSchema` | `AppSettingsDTO` | partial; excludes `setupCompleted` |

### Setup (wizard, Phase 4)
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/setup/status` | — | `SetupStatusDTO` | setupCompleted + current appearance + app/category counts + starter templates |
| POST | `/api/setup/complete` | `setupCompleteSchema` (`{ settings?, auth? }`) | `SetupStatusDTO` | optional final settings + auth (admin creds → enable, or `{skip:true}` → disable); marks complete; idempotent; never destroys data |
| POST | `/api/setup/seed` | `setupSeedSchema` (`{ template: "blank" \| "homelab" }`) | `SetupSeedResultDTO` | seeds generic starter categories; idempotent (skips existing by name); no starter apps in v0.1 |

> `SetupStatusDTO` / `SetupSeedResultDTO` + `setupCompleteSchema` / `setupSeedSchema`
> were added by Backend in Phase 4 (the contract previously listed these as a
> placeholder); additive, pending Architect ratification. Starter templates are
> categories-only and contain no hardcoded apps/domains/IPs.

### Categories
| Method | Path | Request schema | Response data |
|---|---|---|---|
| GET | `/api/categories` | — | `ListResult<CategoryDTO>` |
| POST | `/api/categories` | `categoryCreateSchema` | `CategoryDTO` |
| PATCH | `/api/categories/:id` | `idParamSchema` + `categoryUpdateSchema` | `CategoryDTO` |
| DELETE | `/api/categories/:id` | `idParamSchema` | `{ id: number }` |
| POST | `/api/categories/reorder` | `categoryReorderSchema` | `ListResult<CategoryDTO>` |

Deleting a category sets its apps' `categoryId` to null (schema `onDelete: set null`).

### Apps
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/apps` | (query: `lifecycle?`, `includeHidden?`) | `ListResult<AppDTO>` | `latestHealth` embedded |
| POST | `/api/apps` | `appCreateSchema` | `AppDTO` | |
| GET | `/api/apps/:id` | `idParamSchema` | `AppDTO` | |
| PATCH | `/api/apps/:id` | `idParamSchema` + `appUpdateSchema` | `AppDTO` | |
| DELETE | `/api/apps/:id` | `idParamSchema` | `{ id: number }` | hard delete; prefer `retire` |
| POST | `/api/apps/reorder` | `appReorderSchema` | `ListResult<AppDTO>` | |
| POST | `/api/apps/:id/favourite` | `idParamSchema` + `appFavouriteSchema` | `AppDTO` | |
| POST | `/api/apps/:id/lifecycle` | `idParamSchema` + `appLifecycleActionSchema` | `AppDTO` | hide/unhide, enable/disable health, retire/restore |

### App health
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/apps/:id/health` | `idParamSchema` + `healthHistoryQuerySchema` | `{ stats: AppHealthStatsDTO, history: AppHealthResultDTO[] }` | uptime computed over `windowHours` |
| POST | `/api/apps/:id/health/check` | `idParamSchema` | `AppHealthResultDTO` | on-demand check via guarded fetch |

### Dashboard widgets
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/dashboard/widgets` | — | `DashboardLayoutDTO` | v0.1: read-only default derived from enabled modules |
| ~~PUT~~ | ~~`/api/dashboard/widgets`~~ | `dashboardLayoutUpdateSchema` | — | **v0.3** layout customisation — schema defined, endpoint not built in v0.1 |

### Local system metrics (Backend Phase 1; FE consumes)
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/metrics` | `metricsQuerySchema` (query) | `MetricsResponseDTO` (`{ points: MetricPointDTO[] }`) | no `window` → latest per (sourceId, metric); with `window` (minutes) + optional `sourceId` → windowed points |
| POST | `/api/metrics/refresh` | — | `{ refreshed: true }` | triggers `scheduler.runNow("system-metrics")`; `503 job_unavailable` if scheduler not running |

v0.1 `sourceId`/`metric` pairs emitted by the core collector (container-visible,
ADR 0008): `cpu/usage_percent`, `memory/{usage_percent,bytes_total,bytes_used}`,
`storage/{usage_percent,bytes_total,bytes_used}`,
`network/{rx_bytes_per_sec,tx_bytes_per_sec}`, `uptime/{system_seconds,process_seconds}`.
CPU and network are delta-based and first appear on the second collection cycle.

> `MetricPointDTO` was added by Backend when it landed the collector (the
> contract previously deferred it).

### Notification centre (Phase 3)
Notifications are server-generated by the event pipeline (app health
transitions + system threshold breaches/recoveries), deduplicated per
`dedupeKey`, and persisted across restarts.

| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/notifications` | `notificationQuerySchema` (query) | `ListResult<NotificationDTO>` | filters: `unread`, `includeDismissed`, `severity`, `source`, `limit`, `offset`; dismissed hidden by default |
| GET | `/api/notifications/counts` | — | `NotificationCountsDTO` (`{ total, unread }`) | active (non-dismissed) totals |
| PATCH | `/api/notifications/:id/read` | `idParamSchema` | `NotificationDTO` | `404 not_found` if missing |
| PATCH | `/api/notifications/read-all` | — | `{ updated: number }` | marks all active unread as read |
| PATCH | `/api/notifications/:id/dismiss` | `idParamSchema` | `NotificationDTO` | |
| PATCH | `/api/notifications/dismiss-all` | — | `{ updated: number }` | |
| DELETE | `/api/notifications/dismissed` | — | `{ deleted: number }` | permanently clears dismissed |

> `NotificationDTO` / `NotificationCountsDTO` + `notificationQuerySchema` were
> added by Backend in Phase 3 (the contract previously deferred them); additive,
> pending Architect ratification.

### Auth (Phase 5 hardening)
Single admin user; optional (`authEnabled` setting). scrypt password hashing;
session cookie `bd_session` (httpOnly, SameSite=Lax, Secure on HTTPS) carrying a
random token whose sha256 is stored in `sessions`.

| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | `loginSchema` | `AuthStatusDTO` | sets session cookie; `401 invalid_credentials` on failure |
| POST | `/api/auth/logout` | — | `{ ok: true }` | revokes session + clears cookie |
| GET | `/api/auth/session` | — | `AuthStatusDTO` (`{ authEnabled, authenticated, needsAdmin, username }`) | public |

### Health & readiness (Phase 5)
| Method | Path | Response data | Notes |
|---|---|---|---|
| GET | `/api/health` | `{ status, version, time }` | liveness; dependency-free; public |
| GET | `/api/health/ready` | `{ ready: true }` or `503 not_ready` | readiness (DB `SELECT 1`); public |

> `AuthStatusDTO` + `loginSchema` + the `setupCompleteSchema.auth` block were
> added by Backend in Phase 5 (ratified). Enforcement lives in the Node runtime
> (`route()`/`protectedRoute()` for APIs; server layout helpers for pages) — never
> in Edge middleware (better-sqlite3 is Node-only). `AUTH_DISABLE=1` bypasses auth
> for recovery (CSRF still applies).

## Source of truth
- Types: `src/lib/types/{settings,categories,apps,health,widgets,metrics,notifications,setup,auth,common}.ts`
- Schemas: `src/lib/validation/{settings,categories,apps,health,widgets,metrics,notifications,setup,auth,common}.ts`
