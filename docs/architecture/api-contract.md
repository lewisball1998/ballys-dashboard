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
- **Mutations:** all non-GET routes are same-origin checked + CSRF-protected
  (enforced in the v0.1 hardening phase). Auth, when enabled, gates all routes.
- **Errors:** `400` validation, `401` unauthenticated, `404` not_found,
  `409` conflict, `500` internal.

## Endpoints

### Settings
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/settings` | — | `AppSettingsDTO` | structured view of the kv store |
| PATCH | `/api/settings` | `settingsUpdateSchema` | `AppSettingsDTO` | partial; excludes `setupCompleted` |

### Setup (wizard)
| Method | Path | Request schema | Response data | Notes |
|---|---|---|---|---|
| GET | `/api/setup/status` | — | `{ setupCompleted: boolean }` | |
| POST | `/api/setup/complete` | (settings subset, defined in Phase 1 wizard work) | `AppSettingsDTO` | sets `setupCompleted` |

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
| Method | Path | Response data | Notes |
|---|---|---|---|
| GET | `/api/metrics` | metric series (DTOs finalised when Backend lands the collector) | container-visible CPU/RAM/storage/network/uptime |
| POST | `/api/metrics/refresh` | `{ ok: true }` | triggers `scheduler.runNow("system-metrics")` |

> Metrics and notifications DTOs are stubbed for Phase 3 detail; the system
> metrics read endpoint is needed by Phase 1 FE widgets and will reuse the
> `metrics` table shape. Notification centre endpoints are documented in Phase 3.

## Source of truth
- Types: `src/lib/types/{settings,categories,apps,health,widgets,common}.ts`
- Schemas: `src/lib/validation/{settings,categories,apps,health,widgets,common}.ts`
