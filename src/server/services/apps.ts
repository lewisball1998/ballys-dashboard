import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import type { App } from "@/db/schema";
import type { AppDTO, AppHealthResultDTO, AppLifecycleAction } from "@/lib/types";
import type { AppCreateInput, AppReorderInput, AppUpdateInput } from "@/lib/validation";
import { getLatestHealth, getLatestHealthMap } from "./app-health";

export interface AppListFilter {
  lifecycle: "active" | "retired" | "all";
  includeHidden: boolean;
}

function toDTO(row: App, latestHealth: AppHealthResultDTO | null): AppDTO {
  return {
    id: row.id,
    categoryId: row.categoryId ?? null,
    name: row.name,
    url: row.url,
    icon: row.icon ?? null,
    description: row.description ?? null,
    openNewTab: row.openNewTab,
    isFavourite: row.isFavourite,
    authRequired: row.authRequired,
    healthUrl: row.healthUrl ?? null,
    healthEnabled: row.healthEnabled,
    isHidden: row.isHidden,
    lifecycle: row.lifecycle,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    latestHealth,
  };
}

function nextSortOrder(categoryId: number | null): number {
  const cond = categoryId == null ? isNull(apps.categoryId) : eq(apps.categoryId, categoryId);
  const row = db.select({ max: sql<number | null>`max(${apps.sortOrder})` }).from(apps).where(cond).get();
  return (row?.max ?? -1) + 1;
}

export function listApps(filter: AppListFilter): AppDTO[] {
  const conds = [];
  if (filter.lifecycle !== "all") conds.push(eq(apps.lifecycle, filter.lifecycle));
  if (!filter.includeHidden) conds.push(eq(apps.isHidden, false));

  const rows = db
    .select()
    .from(apps)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(apps.sortOrder), asc(apps.id))
    .all();

  const healthMap = getLatestHealthMap(rows.map((r) => r.id));
  return rows.map((r) => toDTO(r, healthMap.get(r.id) ?? null));
}

/** Apps eligible for scheduled health checks: enabled AND active (not retired). */
export function listCheckableApps(): App[] {
  return db
    .select()
    .from(apps)
    .where(and(eq(apps.healthEnabled, true), eq(apps.lifecycle, "active")))
    .all();
}

export function getApp(id: number): AppDTO | null {
  const row = db.select().from(apps).where(eq(apps.id, id)).get();
  if (!row) return null;
  return toDTO(row, getLatestHealth(id));
}

export function createApp(input: AppCreateInput): AppDTO {
  const categoryId = input.categoryId ?? null;
  const now = new Date();
  const row = db
    .insert(apps)
    .values({
      categoryId,
      name: input.name,
      url: input.url,
      icon: input.icon ?? null,
      description: input.description ?? null,
      openNewTab: input.openNewTab ?? true,
      isFavourite: input.isFavourite ?? false,
      authRequired: input.authRequired ?? false,
      healthUrl: input.healthUrl ?? null,
      healthEnabled: input.healthEnabled ?? false,
      sortOrder: input.sortOrder ?? nextSortOrder(categoryId),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return toDTO(row, null);
}

export function updateApp(id: number, input: AppUpdateInput): AppDTO | null {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.url !== undefined) set.url = input.url;
  if (input.categoryId !== undefined) set.categoryId = input.categoryId ?? null;
  if (input.icon !== undefined) set.icon = input.icon ?? null;
  if (input.description !== undefined) set.description = input.description ?? null;
  if (input.openNewTab !== undefined) set.openNewTab = input.openNewTab;
  if (input.isFavourite !== undefined) set.isFavourite = input.isFavourite;
  if (input.authRequired !== undefined) set.authRequired = input.authRequired;
  if (input.healthUrl !== undefined) set.healthUrl = input.healthUrl ?? null;
  if (input.healthEnabled !== undefined) set.healthEnabled = input.healthEnabled;
  if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;

  const row = db.update(apps).set(set).where(eq(apps.id, id)).returning().get();
  return row ? toDTO(row, getLatestHealth(id)) : null;
}

export function deleteApp(id: number): boolean {
  // app_health rows cascade-delete via the FK rule.
  return db.delete(apps).where(eq(apps.id, id)).run().changes > 0;
}

export function reorderApps(input: AppReorderInput): AppDTO[] {
  const now = new Date();
  const moveCategory = input.categoryId !== undefined;
  db.transaction((tx) => {
    input.ids.forEach((id, index) => {
      const set: Record<string, unknown> = { sortOrder: index, updatedAt: now };
      if (moveCategory) set.categoryId = input.categoryId ?? null;
      tx.update(apps).set(set).where(eq(apps.id, id)).run();
    });
  });
  return listApps({ lifecycle: "all", includeHidden: true });
}

export function setFavourite(id: number, isFavourite: boolean): AppDTO | null {
  const row = db
    .update(apps)
    .set({ isFavourite, updatedAt: new Date() })
    .where(eq(apps.id, id))
    .returning()
    .get();
  return row ? toDTO(row, getLatestHealth(id)) : null;
}

export function applyLifecycle(id: number, action: AppLifecycleAction): AppDTO | null {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  switch (action) {
    case "hide":
      set.isHidden = true;
      break;
    case "unhide":
      set.isHidden = false;
      break;
    case "disable-health":
      set.healthEnabled = false;
      break;
    case "enable-health":
      set.healthEnabled = true;
      break;
    case "retire":
      set.lifecycle = "retired";
      break;
    case "restore":
      set.lifecycle = "active";
      break;
  }
  const row = db.update(apps).set(set).where(eq(apps.id, id)).returning().get();
  return row ? toDTO(row, getLatestHealth(id)) : null;
}
