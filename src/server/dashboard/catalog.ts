import { initializeModules, registry } from "@/modules";
import type { WidgetDefinition } from "@/modules/types";
import type { WidgetCatalogEntry, WidgetSizeToken } from "@/lib/types";

/**
 * The widget catalog — the authoritative list of *available* widgets, derived
 * from the enabled modules' contributed `WidgetDefinition`s. Single source of
 * truth for both building the default layout and reconciling persisted configs
 * (what counts as a "known" widget). Server-only: the module registry may hold
 * provider closures that touch sockets/files.
 */

/** Map a module's optional numeric defaultSize to a width token (width only). */
function defaultSizeToken(def: WidgetDefinition): WidgetSizeToken {
  const w = def.defaultSize?.w;
  if (w == null) return "medium";
  if (w <= 1) return "small";
  if (w === 2) return "medium";
  if (w === 3) return "wide";
  return "full";
}

export function buildWidgetCatalog(): WidgetCatalogEntry[] {
  initializeModules();
  const entries: WidgetCatalogEntry[] = [];
  for (const mod of registry.list()) {
    for (const def of mod.capabilities.widgets ?? []) {
      entries.push({
        moduleId: mod.id,
        widgetKey: def.id,
        componentKey: def.componentKey,
        title: def.title,
        defaultSize: defaultSizeToken(def),
      });
    }
  }
  return entries;
}

/** Index a catalog by `widgetKey` for O(1) lookups during reconcile/resolve. */
export function indexCatalog(
  catalog: WidgetCatalogEntry[],
): Map<string, WidgetCatalogEntry> {
  return new Map(catalog.map((entry) => [entry.widgetKey, entry]));
}
