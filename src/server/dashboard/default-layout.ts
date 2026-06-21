import {
  CURRENT_LAYOUT_VERSION,
  DEFAULT_SECTION_ID,
  DEFAULT_SECTION_TITLE,
} from "@/lib/dashboard";
import type {
  DashboardLayoutConfig,
  PlacedWidget,
  WidgetCatalogEntry,
  WidgetSizeToken,
} from "@/lib/types";
import { buildWidgetCatalog } from "./catalog";

/**
 * The built-in default layout — effectively the product's default template.
 *
 * The canonical arrangement reproduces the pre-v0.2.2 homepage exactly (single
 * unnamed section; same widgets, order and sizes) so a fresh install is visually
 * unchanged. Any catalog widget not named here (e.g. a future module's widget) is
 * appended to the default section, visible, using its catalog default size.
 */
const DEFAULT_ARRANGEMENT: { widgetKey: string; size: WidgetSizeToken }[] = [
  { widgetKey: "system-overview", size: "medium" },
  { widgetKey: "favourite-apps", size: "medium" },
  { widgetKey: "app-health-summary", size: "small" },
  { widgetKey: "notifications", size: "small" },
];

export function buildDefaultLayout(
  catalog: WidgetCatalogEntry[] = buildWidgetCatalog(),
): DashboardLayoutConfig {
  const byKey = new Map(catalog.map((entry) => [entry.widgetKey, entry]));
  const placed: PlacedWidget[] = [];
  const used = new Set<string>();

  const place = (entry: WidgetCatalogEntry, size: WidgetSizeToken) => {
    placed.push({
      id: `${entry.moduleId}:${entry.widgetKey}`,
      widgetKey: entry.widgetKey,
      hidden: false,
      size,
      order: placed.length,
      config: {},
    });
    used.add(entry.widgetKey);
  };

  // 1. The canonical arrangement, in order, for widgets that still exist.
  for (const item of DEFAULT_ARRANGEMENT) {
    const entry = byKey.get(item.widgetKey);
    if (entry) place(entry, item.size);
  }

  // 2. Any remaining catalog widgets (future modules) appended, visible.
  for (const entry of catalog) {
    if (used.has(entry.widgetKey)) continue;
    place(entry, entry.defaultSize);
  }

  return {
    version: CURRENT_LAYOUT_VERSION,
    sections: [
      {
        id: DEFAULT_SECTION_ID,
        title: DEFAULT_SECTION_TITLE,
        order: 0,
        widgets: placed,
      },
    ],
  };
}
