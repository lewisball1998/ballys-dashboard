import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Imported user icon packs (v0.2.8).
 *
 * Like `custom_icons`, the image *bytes* live on the data volume — here under
 * `<ICONS_DIR>/packs/<packId>/<sha256>.<ext>` — NOT in the DB. These tables hold
 * only metadata so packs can be listed, served by `(packId, key[, variant])`,
 * and deleted (files + rows). A filesystem path is never exposed to the client.
 */
export const iconPacks = sqliteTable("icon_packs", {
  /** Manifest slug; the `pack:<id>/…` reference and on-disk dir name. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  author: text("author"),
  license: text("license"),
  /** Display/link only — never fetched. */
  homepage: text("homepage"),
  manifestVersion: integer("manifest_version").notNull(),
  iconCount: integer("icon_count").notNull(),
  /** Total bytes stored on disk for this pack. */
  bytes: integer("bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * One row per (pack, icon key, variant). `variant` NULL = the base icon; a
 * non-null variant is an alternate file (e.g. "4k"). `sha256`/`ext` locate the
 * stored file; multiple keys/variants may share one deduped file.
 */
export const iconPackIcons = sqliteTable(
  "icon_pack_icons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: text("pack_id")
      .notNull()
      .references(() => iconPacks.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label"),
    /** NULL = base icon; otherwise the declared variant slug. */
    variant: text("variant"),
    sha256: text("sha256").notNull(),
    ext: text("ext").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
  },
  (t) => [
    uniqueIndex("icon_pack_icons_pack_key_variant_idx").on(t.packId, t.key, t.variant),
    index("icon_pack_icons_pack_key_idx").on(t.packId, t.key),
    index("icon_pack_icons_sha256_idx").on(t.sha256),
  ],
);

export type IconPackRow = typeof iconPacks.$inferSelect;
export type NewIconPackRow = typeof iconPacks.$inferInsert;
export type IconPackIconRow = typeof iconPackIcons.$inferSelect;
export type NewIconPackIconRow = typeof iconPackIcons.$inferInsert;
