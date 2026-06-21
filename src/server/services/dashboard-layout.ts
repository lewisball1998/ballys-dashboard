import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dashboardLayouts } from "@/db/schema";
import { dashboardLayoutConfigSchema } from "@/lib/validation";
import type { DashboardLayoutConfig, DashboardLayoutDTO } from "@/lib/types";
import { buildWidgetCatalog } from "@/server/dashboard/catalog";
import { buildDefaultLayout } from "@/server/dashboard/default-layout";
import { migrateLayoutConfig } from "@/server/dashboard/migrate-config";
import { reconcileConfig, resolveLayout } from "@/server/dashboard/reconcile";

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

/** The resolved, render-ready layout: persisted (reconciled) or the default. */
export function getResolvedLayout(): DashboardLayoutDTO {
  const catalog = buildWidgetCatalog();
  const stored = readStoredConfig();
  const config = stored ? reconcileConfig(stored, catalog) : buildDefaultLayout(catalog);
  return resolveLayout(config, catalog);
}

/** Validate-reconciled save of the user-default layout; returns the resolved result. */
export function saveLayout(input: DashboardLayoutConfig): DashboardLayoutDTO {
  const catalog = buildWidgetCatalog();
  const reconciled = reconcileConfig(input, catalog);
  persistUserDefault(reconciled);
  return resolveLayout(reconciled, catalog);
}

/** Reset to the built-in default by clearing the stored row. */
export function resetLayout(): DashboardLayoutDTO {
  const catalog = buildWidgetCatalog();
  db.delete(dashboardLayouts).where(userDefaultWhere).run();
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
