import type { DashboardWidgetDTO } from "@/lib/types";

/**
 * v0.1 default dashboard layout (read-only). Shaped as DashboardWidgetDTO so it
 * can be swapped for `GET /api/dashboard/widgets` without changing the grid.
 * Mirrors the core module's contributed widgets.
 */
export const DEFAULT_WIDGETS: DashboardWidgetDTO[] = [
  {
    id: "core:system-overview",
    moduleId: "core",
    widgetId: "system-overview",
    componentKey: "system-overview",
    title: "System",
    size: { w: 2, h: 1 },
    order: 0,
    config: {},
  },
  {
    id: "core:favourite-apps",
    moduleId: "core",
    widgetId: "favourite-apps",
    componentKey: "favourite-apps",
    title: "Quick Launch",
    size: { w: 2, h: 1 },
    order: 1,
    config: {},
  },
  {
    id: "core:app-health-summary",
    moduleId: "core",
    widgetId: "app-health-summary",
    componentKey: "app-health-summary",
    title: "App Health",
    size: { w: 1, h: 1 },
    order: 2,
    config: {},
  },
  {
    id: "core:notifications",
    moduleId: "core",
    widgetId: "notifications",
    componentKey: "notifications",
    title: "Notifications",
    size: { w: 1, h: 1 },
    order: 3,
    config: {},
  },
];
