/**
 * App health DTOs. ⭐ ARCHITECT-OWNED. Health rows are server-generated (no
 * user-facing create/update), so there are no request schemas for them — only
 * a query schema for history (lib/validation/health).
 */
import type { HealthStatus } from "./common";

/** A single health check result (mirrors `app_health`). */
export interface AppHealthResultDTO {
  id: number;
  appId: number;
  status: HealthStatus;
  statusCode: number | null;
  latencyMs: number | null;
  message: string | null;
  checkedAt: string;
}

/** Aggregated health for an app over a window (uptime computed from history). */
export interface AppHealthStatsDTO {
  appId: number;
  status: HealthStatus;
  latencyMs: number | null;
  /** 0–100 over `windowHours`. */
  uptimePercent: number;
  windowHours: number;
  lastCheckedAt: string | null;
}
