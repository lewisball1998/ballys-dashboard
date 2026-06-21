import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dashboardLayouts } from "@/db/schema";
import { dashboardLayoutConfigSchema } from "@/lib/validation";
import { APP_WIDGET_KEY, readAppId } from "@/lib/dashboard";
import type { DashboardLayoutConfig, DashboardLayoutDTO } from "@/lib/types";
import { buildWidgetCatalog } from "@/server/dashboard/catalog";
import { buildDefaultLayout } from "@/server/dashboard/default-layout";
import { migrateLayoutConfig } from "@/server/dashboard/migrate-config";
import { reconcileConfig, resolveLayout } from "@/server/dashboard/reconcile";
import { getAppNames } from "@/server/services/apps";

/**
 * Dashboard layout persistence. The only DB-touching layer for layouts.
 *
 * v0.2.2 manages a single global row: the user-default layout
 * (`kind = 'user-default'`, `ownerKey = NULL`). Reads never throw — a missing,
 * corrupt or invalid stored document falls back to the computed default so the
 * homepage always renders.
 */
const USER_DEFAULT_KIND = "user-default" as const;

const userDefaultWhere = and(
  eq(dashboardLayouts.kind, USER_DEFAULT_KIND),
  isNull(dashboardLayouts.ownerKey),
);

/** Read + migrate + validate the stored user-default config, or null if absent/invalid. */
function readStoredConfig(): DashboardLayoutConfig | null {
  const row = db.select().from(dashboardLayouts).where(userDefaultWhere).get();
  if (!row) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.config);
  } catch {
    console.error("[dashboard-layout] stored config is not valid JSON; using default");
    return null;
  }

  const result = dashboardLayoutConfigSchema.safeParse(migrateLayoutConfig(parsed));
  if (!result.success) {
    console.error("[dashboard-layout] stored config failed validation; using default");
    return null;
  }
  return result.data;
}

/**
 * Fill in app-widget titles from the apps table. `resolveLayout` stays pure
 * (catalog-only); the app *name* is dynamic data, so it is joined in here, in the
 * DB-aware service layer. A missing app (deleted/unknown) gets a calm fallback so
 * the SSR card header is sane before the client renders its unavailable state.
 */
function enrichAppWidgetTitles(dto: DashboardLayoutDTO): DashboardLayoutDTO {
  const ids: number[] = [];
  for (const section of dto.sections) {
    for (const w of section.widgets) {
      if (w.widgetKey !== APP_WIDGET_KEY) continue;
      const appId = readAppId(w.config);
      if (appId !== null) ids.push(appId);
    }
  }
  if (ids.length === 0) return dto;

  const names = getAppNames(ids);
  return {
    ...dto,
    sections: dto.sections.map((section) => ({
      ...section,
      widgets: section.widgets.map((w) => {
        if (w.widgetKey !== APP_WIDGET_KEY) return w;
        const appId = readAppId(w.config);
        const name = appId !== null ? names.get(appId) : undefined;
        return { ...w, title: name ?? "Unavailable app" };
      }),
    })),
  };
}

/** The resolved, render-ready layout: persisted (reconciled) or the default. */
export function getResolvedLayout(): DashboardLayoutDTO {
  const catalog = buildWidgetCatalog();
  const stored = readStoredConfig();
  const config = stored ? reconcileConfig(stored, catalog) : buildDefaultLayout(catalog);
  return enrichAppWidgetTitles(resolveLayout(config, catalog));
}

/** Validate-reconciled save of the user-default layout; returns the resolved result. */
export function saveLayout(input: DashboardLayoutConfig): DashboardLayoutDTO {
  const catalog = buildWidgetCatalog();
  const reconciled = reconcileConfig(input, catalog);
  persistUserDefault(reconciled);
  return enrichAppWidgetTitles(resolveLayout(reconciled, catalog));
}

/** Reset to the built-in default by clearing the stored row. */
export function resetLayout(): DashboardLayoutDTO {
  const catalog = buildWidgetCatalog();
  db.delete(dashboardLayouts).where(userDefaultWhere).run();
  // The default layout contains no app widgets, so no enrichment is needed.
  return resolveLayout(buildDefaultLayout(catalog), catalog);
}

/** Lookup-then-upsert keeps exactly one user-default row (the DB invariant). */
function persistUserDefault(config: DashboardLayoutConfig): void {
  const now = new Date();
  const json = JSON.stringify(config);
  db.transaction((tx) => {
    const existing = tx
      .select({ id: dashboardLayouts.id })
      .from(dashboardLayouts)
      .where(userDefaultWhere)
      .get();
    if (existing) {
      tx.update(dashboardLayouts)
        .set({ config: json, schemaVersion: config.version, updatedAt: now })
        .where(eq(dashboardLayouts.id, existing.id))
        .run();
    } else {
      tx.insert(dashboardLayouts)
        .values({
          kind: USER_DEFAULT_KIND,
          ownerKey: null,
          name: null,
          schemaVersion: config.version,
          config: json,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
}
