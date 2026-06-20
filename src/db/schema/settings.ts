import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Key/value application settings. This is what makes the product usable with no
 * config-file editing: dashboard name, theme, timezone, intervals, thresholds,
 * `setup_completed`, etc. all live here (see SETTING_KEYS in lib/constants).
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
