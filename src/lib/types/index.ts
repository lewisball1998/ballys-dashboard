/**
 * Shared, transport-safe types (DTOs) used by both the API layer and the UI.
 *
 * OWNED BY: Product Architect. This is a ⭐ contract file — Backend and
 * Frontend consume these types so they can build against the same shapes in
 * parallel. Phase 1 expands this with concrete resource DTOs (apps, metrics,
 * notifications, …). Phase 0 establishes the envelope + primitives only.
 */

/** Severity levels shared by notifications and events. */
export type Severity = "info" | "success" | "warning" | "error";

/** Health states shared by app health checks and (later) module health. */
export type HealthStatus = "up" | "down" | "degraded" | "unknown";

/** Standard API success/error envelope returned by route handlers. */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface ApiError {
  code: string;
  message: string;
  /** Optional field-level validation issues (mirrors zod flatten). */
  fields?: Record<string, string[]>;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function err(code: string, message: string, fields?: Record<string, string[]>): ApiResponse<never> {
  return { ok: false, error: { code, message, fields } };
}
