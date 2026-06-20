/**
 * Shared transport primitives. ⭐ ARCHITECT-OWNED.
 *
 * Convention: every timestamp field in a DTO is an ISO 8601 string in UTC
 * (JSON has no Date type; the DB layer stores `Date` and serialises on the way
 * out). Numbers are plain numbers, booleans are booleans.
 */

/** Severity levels shared by notifications and events. */
export type Severity = "info" | "success" | "warning" | "error";

/** Health states shared by app health checks and (later) module health. */
export type HealthStatus = "up" | "down" | "degraded" | "unknown";

/** Standard API success/error envelope returned by every route handler. */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface ApiError {
  /** Stable, machine-readable code, e.g. "validation_error", "not_found". */
  code: string;
  message: string;
  /** Optional field-level validation issues (mirrors zod flatten). */
  fields?: Record<string, string[]>;
}

/** List endpoints return this inside the envelope. */
export interface ListResult<T> {
  items: T[];
  total: number;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function err(
  code: string,
  message: string,
  fields?: Record<string, string[]>,
): ApiResponse<never> {
  return { ok: false, error: { code, message, fields } };
}
