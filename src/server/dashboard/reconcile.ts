import {
  APP_WIDGET_KEY,
  CURRENT_LAYOUT_VERSION,
  DEFAULT_SECTION_ID,
  DEFAULT_SECTION_TITLE,
  readAppId,
  sizeTokenToColumns,
} from "@/lib/dashboard";
import type {
  DashboardLayoutConfig,
  DashboardLayoutDTO,
  LayoutSection,
  PlacedWidget,
  ResolvedSection,
  ResolvedWidget,
  WidgetCatalogEntry,
} from "@/lib/types";
import { indexCatalog } from "./catalog";

/**
 * Pure layout normalisation/resolution. No DB, no validation — callers validate
 * with the zod schema first, then reconcile against the catalog, then resolve.
 *
 * reconcileConfig: make a (schema-valid) document safe and canonical —
 *   - guarantee at least one section (the default section if none survive);
 *   - drop widgets whose widgetKey is not in the catalog (removed/unknown);
 *   - drop malformed app instances (widgetKey "app" without a valid config.appId);
 *   - drop duplicate widget ids (keep first occurrence across the whole layout);
 *   - append catalog *singleton* widgets absent everywhere to the FIRST section,
 *     visible (so a new module's widget auto-appears on existing saved layouts);
 *     instanceable widgets (e.g. the app widget) are never auto-appended;
 *   - normalise section order and per-section widget order to 0..n-1.
 *
 * resolveLayout: join the catalog in to produce the render-ready DTO (title,
 *   componentKey, column width), preserving hidden widgets so the editor can
 *   restore them; the renderer is responsible for filtering hidden ones.
 */
export function reconcileConfig(
  config: DashboardLayoutConfig,
  catalog: WidgetCatalogEntry[],
): DashboardLayoutConfig {
  const known = indexCatalog(catalog);
  const seenIds = new Set<string>();
  const placedKeys = new Set<string>();

  const sectionsInput =
    config.sections.length > 0
      ? config.sections
      : [{ id: DEFAULT_SECTION_ID, title: DEFAULT_SECTION_TITLE, order: 0, widgets: [] }];

  const sections: LayoutSection[] = [...sectionsInput]
    .sort((a, b) => a.order - b.order)
    .map((section, sectionIndex) => {
      const widgets: PlacedWidget[] = [];
      for (const widget of [...section.widgets].sort((a, b) => a.order - b.order)) {
        if (!known.has(widget.widgetKey)) continue; // unknown/removed widget
        // App instances must carry a valid appId; drop malformed ones defensively
        // (hand-edited / corrupt documents) before they reach the client.
        if (widget.widgetKey === APP_WIDGET_KEY && readAppId(widget.config) === null) continue;
        if (seenIds.has(widget.id)) continue; // duplicate instance id
        seenIds.add(widget.id);
        placedKeys.add(widget.widgetKey);
        widgets.push({
          id: widget.id,
          widgetKey: widget.widgetKey,
          hidden: widget.hidden,
          size: widget.size,
          order: widgets.length,
          config: widget.config ?? {},
        });
      }
      return {
        id: section.id,
        title: section.title,
        order: sectionIndex,
        widgets,
      };
    });

  // Append any catalog *singleton* widgets not present anywhere to the first
  // section, visible. Instanceable templates are user-added only — never seeded.
  const additions = catalog.filter(
    (entry) => !entry.instanceable && !placedKeys.has(entry.widgetKey),
  );
  const target = sections[0];
  if (additions.length > 0 && target) {
    for (const entry of additions) {
      const id = `${entry.moduleId}:${entry.widgetKey}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      target.widgets.push({
        id,
        widgetKey: entry.widgetKey,
        hidden: false,
        size: entry.defaultSize,
        order: target.widgets.length,
        config: {},
      });
    }
  }

  return { version: CURRENT_LAYOUT_VERSION, sections };
}

export function resolveLayout(
  config: DashboardLayoutConfig,
  catalog: WidgetCatalogEntry[],
): DashboardLayoutDTO {
  const known = indexCatalog(catalog);

  const sections: ResolvedSection[] = [...config.sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const widgets: ResolvedWidget[] = [];
      for (const widget of [...section.widgets].sort((a, b) => a.order - b.order)) {
        const entry = known.get(widget.widgetKey);
        if (!entry) continue; // defensive: reconciled configs never hit this
        widgets.push({
          id: widget.id,
          widgetKey: widget.widgetKey,
          componentKey: entry.componentKey,
          title: entry.title,
          size: widget.size,
          columns: sizeTokenToColumns(widget.size),
          hidden: widget.hidden,
          order: widget.order,
          config: widget.config ?? {},
          instanceable: entry.instanceable,
        });
      }
      return { id: section.id, title: section.title, order: section.order, widgets };
    });

  return { version: config.version, sections };
}
