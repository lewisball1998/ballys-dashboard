import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appHealth, apps } from "@/db/schema";
import type { App, AppHealth } from "@/db/schema";
import type { AppHealthResultDTO, AppHealthStatsDTO, HealthStatus } from "@/lib/types";
import { guardedFetch, GuardedFetchError } from "@/server/http/guarded-fetch";

const CHECK_TIMEOUT_MS = 10_000;

export function healthToDTO(row: AppHealth): AppHealthResultDTO {
  return {
    id: row.id,
    appId: row.appId,
    status: row.status,
    statusCode: row.statusCode ?? null,
    latencyMs: row.latencyMs ?? null,
    message: row.message ?? null,
    checkedAt: row.checkedAt.toISOString(),
  };
}

function statusFromCode(code: number): HealthStatus {
  if (code >= 200 && code < 400) return "up";
  if (code >= 400 && code < 500) return "degraded";
  return "down";
}

/** Resolve the URL a health check should hit: healthUrl, falling back to url. */
function healthTarget(app: App): string {
  return app.healthUrl && app.healthUrl.trim().length > 0 ? app.healthUrl : app.url;
}

/**
 * Perform a health check for an app via the guarded fetch wrapper (never bypass
 * it) and persist the result. Returns the persisted result.
 */
export async function checkApp(app: App): Promise<AppHealthResultDTO> {
  let status: HealthStatus = "unknown";
  let statusCode: number | null = null;
  let latencyMs: number | null = null;
  let message: string | null = null;

  try {
    const res = await guardedFetch(healthTarget(app), {
      method: "GET",
      privateNetwork: "allow", // LAN targets are expected for a homelab launcher
      timeoutMs: CHECK_TIMEOUT_MS,
      maxRedirects: 5,
    });
    statusCode = res.status;
    latencyMs = res.durationMs;
    status = statusFromCode(res.status);
    if (status !== "up") message = `HTTP ${res.status}`;
  } catch (error) {
    status = "down";
    message =
      error instanceof GuardedFetchError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "check failed";
  }

  const row = db
    .insert(appHealth)
    .values({ appId: app.id, status, statusCode, latencyMs, message, checkedAt: new Date() })
    .returning()
    .get();
  return healthToDTO(row);
}

/** On-demand check by id (manual endpoint). Returns null if the app is missing. */
export async function checkAppById(id: number): Promise<AppHealthResultDTO | null> {
  const app = db.select().from(apps).where(eq(apps.id, id)).get();
  if (!app) return null;
  return checkApp(app);
}

export function getLatestHealth(appId: number): AppHealthResultDTO | null {
  const row = db
    .select()
    .from(appHealth)
    .where(eq(appHealth.appId, appId))
    .orderBy(desc(appHealth.checkedAt), desc(appHealth.id))
    .limit(1)
    .get();
  return row ? healthToDTO(row) : null;
}

/** Latest health per app id (one query, reduced in memory). */
export function getLatestHealthMap(appIds: number[]): Map<number, AppHealthResultDTO> {
  const map = new Map<number, AppHealthResultDTO>();
  if (appIds.length === 0) return map;
  const rows = db
    .select()
    .from(appHealth)
    .where(inArray(appHealth.appId, appIds))
    .orderBy(desc(appHealth.checkedAt), desc(appHealth.id))
    .all();
  for (const row of rows) {
    if (!map.has(row.appId)) map.set(row.appId, healthToDTO(row));
  }
  return map;
}

export function getHistory(appId: number, windowHours: number, limit: number): AppHealthResultDTO[] {
  const cutoff = new Date(Date.now() - windowHours * 3_600_000);
  return db
    .select()
    .from(appHealth)
    .where(and(eq(appHealth.appId, appId), gte(appHealth.checkedAt, cutoff)))
    .orderBy(desc(appHealth.checkedAt), desc(appHealth.id))
    .limit(limit)
    .all()
    .map(healthToDTO);
}

export function getStats(appId: number, windowHours: number): AppHealthStatsDTO {
  const cutoff = new Date(Date.now() - windowHours * 3_600_000);
  const rows = db
    .select()
    .from(appHealth)
    .where(and(eq(appHealth.appId, appId), gte(appHealth.checkedAt, cutoff)))
    .orderBy(desc(appHealth.checkedAt), desc(appHealth.id))
    .all();
  const total = rows.length;
  const upCount = rows.filter((r) => r.status === "up").length;
  const latest = rows[0];
  return {
    appId,
    status: latest ? latest.status : "unknown",
    latencyMs: latest?.latencyMs ?? null,
    uptimePercent: total > 0 ? Math.round((upCount / total) * 1000) / 10 : 0,
    windowHours,
    lastCheckedAt: latest ? latest.checkedAt.toISOString() : null,
  };
}
