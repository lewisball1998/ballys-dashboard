import type { DashboardLayoutConfig, DashboardLayoutDTO } from "@/lib/types";
import { apiRequest } from "./api-client";

/**
 * Typed, React-free client functions for the v0.2.2 dashboard layout endpoints.
 * The editor uses these directly; nothing here changes the API contract.
 */

/** GET the resolved layout (persisted-reconciled or the computed default). */
export function fetchLayout() {
  return apiRequest<DashboardLayoutDTO>("/api/dashboard/layout");
}

/** PUT the full layout config (server validates → reconciles → persists). */
export function saveLayout(config: DashboardLayoutConfig) {
  return apiRequest<DashboardLayoutDTO>("/api/dashboard/layout", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/** POST reset → restores and returns the default layout. */
export function resetLayout() {
  return apiRequest<DashboardLayoutDTO>("/api/dashboard/layout/reset", { method: "POST" });
}
