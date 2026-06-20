import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { categories } from "./categories";

/**
 * App launcher entries.
 *
 * Lifecycle (Q answer R8) is modelled as three orthogonal axes rather than one
 * enum, because "hide", "disable" and "retire" are independent:
 *   - isHidden:      hidden from the dashboard but otherwise intact
 *   - healthEnabled: false = "disabled" (no health polling)
 *   - lifecycle:     active | retired (retired = archived, restorable)
 */
export const apps = sqliteTable(
  "apps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    icon: text("icon"),
    description: text("description"),
    openNewTab: integer("open_new_tab", { mode: "boolean" }).notNull().default(true),
    isFavourite: integer("is_favourite", { mode: "boolean" }).notNull().default(false),
    authRequired: integer("auth_required", { mode: "boolean" }).notNull().default(false),

    // Health checks
    healthUrl: text("health_url"),
    healthEnabled: integer("health_enabled", { mode: "boolean" }).notNull().default(false),

    // Lifecycle
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    lifecycle: text("lifecycle", { enum: ["active", "retired"] })
      .notNull()
      .default("active"),

    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("apps_category_idx").on(t.categoryId, t.sortOrder)],
);

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
