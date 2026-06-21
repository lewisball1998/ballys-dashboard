import type { ModuleDefinition, MetricProvider, HealthProvider } from "../types";
import { collectSystemMetrics } from "@/server/system/collector";

/**
 * Core module — always present, cannot be disabled. It owns the *built-in*
 * providers that make the dashboard useful with zero integrations.
 *
 * Phase 1: systemMetricsProvider is implemented (container-visible CPU/RAM/
 * storage/network/uptime). appHealthProvider remains a stub until the launcher
 * lands in Phase 2 (it will do guarded HTTP checks per enabled app then).
 */

const systemMetricsProvider: MetricProvider = {
  id: "system",
  async collect() {
    return collectSystemMetrics();
  },
};

const appHealthProvider: HealthProvider = {
  id: "app-health",
  async check() {
    // TODO(phase2): perform a guarded HTTP check per enabled app.
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
      { id: "favourite-apps", title: "Quick Launch", componentKey: "favourite-apps" },
      { id: "notifications", title: "Notifications", componentKey: "notifications" },
      { id: "app-health-summary", title: "App Health", componentKey: "app-health-summary" },
      // Generic, instanceable app widget (v0.2.4): the user adds one per app from
      // the editor; each instance binds to an app via `config.appId`. Never
      // auto-placed (instanceable) so it stays out of the default layout.
      { id: "app", title: "App", componentKey: "app", instanceable: true },
    ],
  },
};
