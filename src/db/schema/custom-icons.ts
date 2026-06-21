import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Uploaded custom icon metadata (v0.2.6).
 *
 * The image *bytes* live on the data volume (sibling `icons/` dir next to the
 * SQLite file), NOT in this table — this keeps the DB lean and lets icons be
 * served efficiently. This row maps an opaque id → stored file so the bytes can
 * be served by id alone (`custom:<id>` reference, `/api/icons/:id/raw`) without
 * ever exposing a filesystem path. `sha256` enables dedup: re-uploading an
 * identical image reuses the existing row instead of writing a second file.
 */
export const customIcons = sqliteTable(
  "custom_icons",
  {
    id: text("id").primaryKey(),
    mime: text("mime").notNull(),
    ext: text("ext").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("custom_icons_sha256_idx").on(t.sha256)],
);

export type CustomIconRow = typeof customIcons.$inferSelect;
export type NewCustomIconRow = typeof customIcons.$inferInsert;
