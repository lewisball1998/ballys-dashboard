import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { iconPacks, iconPackIcons } from "@/db/schema";
import type { IconPackRow } from "@/db/schema";
import type { IconPackDTO, IconPackIconDTO } from "@/lib/types";
import { deletePackDir, readPackAsset, stagePackAssets } from "@/server/icons/storage";
import { PackImportError, preparePackFromZip } from "@/server/icons/pack-import";

function metaToDTO(row: IconPackRow, icons: IconPackIconDTO[]): IconPackDTO {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    author: row.author ?? null,
    license: row.license ?? null,
    homepage: row.homepage ?? null,
    iconCount: row.iconCount,
    bytes: row.bytes,
    createdAt: row.createdAt.toISOString(),
    icons,
  };
}

/** Group icon rows into per-pack DTO icon lists (base rows define order/label). */
function iconsByPack(): Map<string, IconPackIconDTO[]> {
  const rows = db.select().from(iconPackIcons).orderBy(asc(iconPackIcons.id)).all();
  const byPack = new Map<string, Map<string, IconPackIconDTO>>();
  for (const r of rows) {
    let pack = byPack.get(r.packId);
    if (!pack) {
      pack = new Map();
      byPack.set(r.packId, pack);
    }
    let entry = pack.get(r.key);
    if (!entry) {
      entry = { key: r.key, label: null, variants: [] };
      pack.set(r.key, entry);
    }
    if (r.variant == null) entry.label = r.label ?? null;
    else entry.variants.push(r.variant);
  }
  const result = new Map<string, IconPackIconDTO[]>();
  for (const [packId, icons] of byPack) result.set(packId, [...icons.values()]);
  return result;
}

/** All imported packs (newest first) with their icons. */
export function listIconPacks(): IconPackDTO[] {
  const packs = db.select().from(iconPacks).orderBy(desc(iconPacks.createdAt)).all();
  const icons = iconsByPack();
  return packs.map((p) => metaToDTO(p, icons.get(p.id) ?? []));
}

/**
 * Validate + persist an uploaded `.zip` pack. Atomic: assets are staged then
 * moved into place and rows are written in a single transaction; any failure
 * cleans up files and persists nothing. Duplicate pack id → 409.
 */
export function importIconPack(zipBytes: Buffer, zipName?: string | null): IconPackDTO {
  const prep = preparePackFromZip(zipBytes, zipName);
  const packId = prep.manifest.id;

  if (db.select({ id: iconPacks.id }).from(iconPacks).where(eq(iconPacks.id, packId)).get()) {
    throw new PackImportError("duplicate_pack", `A pack with id "${packId}" already exists`, 409);
  }

  // Move files into place first (fails fast if a dir already exists), then rows.
  const storedBytes = stagePackAssets(packId, prep.assets);
  try {
    db.transaction((tx) => {
      tx.insert(iconPacks)
        .values({
          id: packId,
          name: prep.manifest.name,
          version: prep.manifest.version,
          author: prep.manifest.author ?? null,
          license: prep.manifest.license ?? null,
          homepage: prep.manifest.homepage ?? null,
          manifestVersion: prep.manifest.manifestVersion,
          iconCount: prep.manifest.icons.length,
          bytes: storedBytes,
          createdAt: new Date(),
        })
        .run();
      for (const icon of prep.icons) {
        tx.insert(iconPackIcons)
          .values({
            packId,
            key: icon.key,
            label: icon.label,
            variant: icon.variant,
            sha256: icon.sha256,
            ext: icon.ext,
            mime: icon.mime,
            bytes: icon.bytes,
          })
          .run();
      }
    });
  } catch (error) {
    deletePackDir(packId); // roll back the staged files
    throw error instanceof PackImportError
      ? error
      : new PackImportError("import_failed", "Failed to persist the icon pack", 500);
  }

  const dto = listIconPacks().find((p) => p.id === packId);
  if (!dto) throw new PackImportError("import_failed", "Failed to load the imported pack", 500);
  return dto;
}

/**
 * Bytes + mime for a pack icon. A requested variant falls back to the base icon
 * when the variant is absent; a missing pack/icon/file returns null (→ initials).
 */
export function getPackIconBytes(
  packId: string,
  iconKey: string,
  variant: string | null,
): { bytes: Buffer; mime: string } | null {
  let row =
    variant != null
      ? db
          .select()
          .from(iconPackIcons)
          .where(
            and(
              eq(iconPackIcons.packId, packId),
              eq(iconPackIcons.key, iconKey),
              eq(iconPackIcons.variant, variant),
            ),
          )
          .get()
      : undefined;
  if (!row) {
    row = db
      .select()
      .from(iconPackIcons)
      .where(
        and(
          eq(iconPackIcons.packId, packId),
          eq(iconPackIcons.key, iconKey),
          isNull(iconPackIcons.variant),
        ),
      )
      .get();
  }
  if (!row) return null;
  const bytes = readPackAsset(packId, row.sha256, row.ext);
  if (!bytes) return null;
  return { bytes, mime: row.mime };
}

/** Delete a pack: child rows + parent row + on-disk files. False when absent. */
export function deleteIconPack(packId: string): boolean {
  const row = db.select({ id: iconPacks.id }).from(iconPacks).where(eq(iconPacks.id, packId)).get();
  if (!row) return false;
  db.transaction((tx) => {
    tx.delete(iconPackIcons).where(eq(iconPackIcons.packId, packId)).run();
    tx.delete(iconPacks).where(eq(iconPacks.id, packId)).run();
  });
  deletePackDir(packId);
  return true;
}
