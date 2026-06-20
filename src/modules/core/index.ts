import type { ModuleDefinition, MetricProvider, HealthProvider } from "../types";

/**
 * Core module — always present, cannot be disabled. It owns the *built-in*
 * providers that make the dashboard useful with zero integrations.
 *
 * PHASE 0 = SKELETON. The providers below are stubs that return empty/unknown
 * results, present only to exercise the contract + registry wiring end-to-end.
 * Phase 1 (Backend) implements:
 *   - systemMetricsProvider: real CPU/RAM/storage/network from the host view
 *   - appHealthProvider:     real HTTP checks via the guarded fetch wrapper
 */

const systemMetricsProvider: MetricProvider = {
  id: "system",
  async collect() {
    // TODO(phase1): read CPU/RAM/storage/network (container-visible by default).
    return [];
  },
};

const appHealthProvider: HealthProvider = {
  id: "app-health",
  async check() {
    // TODO(phase1): perform a guarded HTTP check per enabled app.
    return { status: "unknown", checkedAt: new Date() };
  },
};

export const coreModule: ModuleDefinition = {
  id: "core",
  name: "Core",
  description: "Built-in system metrics and app health. Always enabled.",
  category: "core",
  isCore: true,
  capabilities: {
    metrics: [systemMetricsProvider],
    health: [appHealthProvider],
    widgets: [
      { id: "system-overview", title: "System", componentKey: "system-overview" },
      { id: "notifications", title: "Notifications", componentKey: "notifications" },
      { id: "app-health-summary", title: "App Health", componentKey: "app-health-summary" },
    ],
  },
};
