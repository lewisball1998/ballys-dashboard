import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Persisted dashboard layouts.
 *
 * Each row stores a versioned layout *document* (the JSON config) rather than one
 * row per placed widget — the layout is a single cohesive document and this makes
 * future import/export a straight serialise of `config`.
 *
 * v0.2.2 reads/writes exactly ONE row: the global user-default
 * (`kind = 'user-default'`, `ownerKey = NULL`). The extra columns scaffold future
 * work WITHOUT another migration:
 *   - kind='template' + name  -> saved layout templates (no picker UI yet)
 *   - ownerKey (nullable)     -> per-user layouts if multi-user ever lands
 * The single-user-default invariant is enforced by the service (lookup-then-upsert).
 */
export const dashboardLayouts = sqliteTable(
  "dashboard_layouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["user-default", "template"] })
      .notNull()
      .default("user-default"),
    ownerKey: text("owner_key"),
    name: text("name"),
    schemaVersion: integer("schema_version").notNull().default(1),
    config: text("config").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("dashboard_layouts_kind_owner_idx").on(t.kind, t.ownerKey)],
);

export type DashboardLayoutRow = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayoutRow = typeof dashboardLayouts.$inferInsert;
