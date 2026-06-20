import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { metrics } from "@/db/schema";
import type { Metric } from "@/db/schema";
import type { MetricPoint } from "@/modules/types";
import type { MetricPointDTO } from "@/lib/types";

function toDTO(row: Metric): MetricPointDTO {
  return {
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    metric: row.metric,
    value: row.value,
    unit: row.unit ?? null,
    recordedAt: row.recordedAt.toISOString(),
  };
}

/** Persist collected metric points. */
export function recordPoints(points: MetricPoint[], sourceType = "system"): void {
  if (points.length === 0) return;
  const now = new Date();
  db.insert(metrics)
    .values(
      points.map((p) => ({
        sourceType,
        sourceId: p.sourceId,
        metric: p.metric,
        value: p.value,
        unit: p.unit ?? null,
        recordedAt: p.recordedAt ?? now,
      })),
    )
    .run();
}

/** Latest value per (sourceId, metric). */
export function getLatestMetrics(scan = 500): MetricPointDTO[] {
  const rows = db
    .select()
    .from(metrics)
    .orderBy(desc(metrics.recordedAt), desc(metrics.id))
    .limit(scan)
    .all();
  const seen = new Set<string>();
  const out: MetricPointDTO[] = [];
  for (const row of rows) {
    const key = `${row.sourceId}|${row.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toDTO(row));
  }
  return out;
}

/** All points within the last `windowMinutes`, optionally filtered by sourceId. */
export function getMetricsWindow(
  windowMinutes: number,
  sourceId: string | undefined,
  limit: number,
): MetricPointDTO[] {
  const cutoff = new Date(Date.now() - windowMinutes * 60_000);
  const where = sourceId
    ? and(gte(metrics.recordedAt, cutoff), eq(metrics.sourceId, sourceId))
    : gte(metrics.recordedAt, cutoff);
  const rows = db.select().from(metrics).where(where).orderBy(metrics.recordedAt).limit(limit).all();
  return rows.map(toDTO);
}

/** Delete metric rows older than the retention window. Returns rows removed. */
export function trimOldMetrics(retentionDays: number): number {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = db.delete(metrics).where(lt(metrics.recordedAt, cutoff)).run();
  return result.changes ?? 0;
}
