import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Persistent notification centre. Survives restarts; dismissible; deduplicated
 * via `dedupeKey` so a service that stays down does not spam every poll cycle.
 * v0.1 sources: app health transitions + CPU/RAM/storage threshold breaches.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    severity: text("severity", { enum: ["info", "success", "warning", "error"] })
      .notNull()
      .default("info"),
    title: text("title").notNull(),
    message: text("message"),
    source: text("source"),
    dedupeKey: text("dedupe_key"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("notifications_dedupe_idx").on(t.dedupeKey),
    index("notifications_created_idx").on(t.createdAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
