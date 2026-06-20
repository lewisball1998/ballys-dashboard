import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { apps } from "./apps";

/**
 * App health check results (time-series). Uptime % is computed from this history
 * over a window, so no separate uptime table is needed in v0.1. Trimmed by the
 * retention job alongside `metrics`.
 */
export const appHealth = sqliteTable(
  "app_health",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["up", "down", "degraded", "unknown"] }).notNull(),
    statusCode: integer("status_code"),
    latencyMs: integer("latency_ms"),
    message: text("message"),
    checkedAt: integer("checked_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("app_health_app_idx").on(t.appId, t.checkedAt)],
);

export type AppHealth = typeof appHealth.$inferSelect;
export type NewAppHealth = typeof appHealth.$inferInsert;
