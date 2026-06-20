import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Generic metric time-series. Deliberately one table for all sources so that a
 * MetricProvider (core or, later, a module) only has to emit points — no schema
 * change per integration.
 *
 *   sourceType: "system" (v0.1) | "module" (v0.2+)
 *   sourceId:   e.g. "cpu", "memory", "disk:/", "net:eth0", or "module:<id>"
 *   metric:     e.g. "usage_percent", "bytes_used", "rx_bytes"
 */
export const metrics = sqliteTable(
  "metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    unit: text("unit"),
    recordedAt: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("metrics_source_idx").on(t.sourceId, t.metric, t.recordedAt)],
);

export type Metric = typeof metrics.$inferSelect;
export type NewMetric = typeof metrics.$inferInsert;
