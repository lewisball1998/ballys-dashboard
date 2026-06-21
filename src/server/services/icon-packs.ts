import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apps, iconPacks, iconPackIcons } from "@/db/schema";
import type { IconPackRow } from "@/db/schema";
import type {
  IconPackDTO,
  IconPackIconDTO,
  PackMatchApplyResultDTO,
  PackMatchOutcomeDTO,
} from "@/lib/types";
import type { PackMatchApplyInput } from "@/lib/validation";
import { buildPackRef, parseIconRef } from "@/lib/icons/resolve";
import { deletePackDir, readPackAsset, stagePackAssets } from "@/server/icons/storage";
import { PackImportError, preparePackFromZip } from "@/server/icons/pack-import";
import { updateApp } from "./apps";

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

const VARIANT_SEP = "/";

/**
 * Bulk-apply user-vetted pack-icon → app assignments (v0.2.9 Icon Pack App
 * Matching). Returns `null` when the pack does not exist (→ route 404).
 *
 * Safety is enforced HERE, independent of the client, so a tampered request can
 * never silently clobber icons (partial success, per-item outcomes — mirrors the
 * Docker import pattern):
 *   - the icon key must exist in this pack (else `skipped`);
 *   - a declared variant that is absent falls back to the base icon (always safe —
 *     a valid key always has a base row);
 *   - the app must exist (else `skipped`);
 *   - an app that already holds this exact ref is a no-op (`skipped` "Already set");
 *   - an app with ANY other explicit icon is `skipped` unless `overwriteCustomised`.
 * Only valid, selected, non-protected assignments write `apps.icon` via
 * {@link buildPackRef}; everything else is reported, never applied.
 */
export function applyPackMatches(
  packId: string,
  input: PackMatchApplyInput,
): PackMatchApplyResultDTO | null {
  const pack = db
    .select({ id: iconPacks.id })
    .from(iconPacks)
    .where(eq(iconPacks.id, packId))
    .get();
  if (!pack) return null;

  // One read of this pack's icons → fast existence checks for key + (key,variant).
  const iconRows = db
    .select({ key: iconPackIcons.key, variant: iconPackIcons.variant })
    .from(iconPackIcons)
    .where(eq(iconPackIcons.packId, packId))
    .all();
  const baseKeys = new Set(iconRows.filter((r) => r.variant == null).map((r) => r.key));
  const variantKeys = new Set(
    iconRows.filter((r) => r.variant != null).map((r) => `${r.key}${VARIANT_SEP}${r.variant}`),
  );

  const overwrite = input.overwriteCustomised === true;
  const outcomes: PackMatchOutcomeDTO[] = [];
  const seen = new Set<number>();

  for (const a of input.assignments) {
    // De-dupe defensively: a repeated appId can only be a client bug.
    if (seen.has(a.appId)) {
      outcomes.push(outcome(a.appId, "", "skipped", null, "Duplicate assignment"));
      continue;
    }
    seen.add(a.appId);

    if (!baseKeys.has(a.iconKey)) {
      outcomes.push(
        outcome(a.appId, "", "skipped", null, `Icon "${a.iconKey}" is not in this pack`),
      );
      continue;
    }

    // Absent/unknown variant → base icon (safe: the base row always exists here).
    const variant =
      a.variant && variantKeys.has(`${a.iconKey}${VARIANT_SEP}${a.variant}`) ? a.variant : null;
    const ref = buildPackRef(packId, a.iconKey, variant);

    const appRow = db
      .select({ id: apps.id, name: apps.name, icon: apps.icon })
      .from(apps)
      .where(eq(apps.id, a.appId))
      .get();
    if (!appRow) {
      outcomes.push(outcome(a.appId, "", "skipped", null, "App not found"));
      continue;
    }

    const current = (appRow.icon ?? "").trim();
    if (current === ref) {
      outcomes.push(outcome(appRow.id, appRow.name, "skipped", ref, "Already set"));
      continue;
    }
    const hasIcon = parseIconRef(current).kind !== "none";
    if (hasIcon && !overwrite) {
      outcomes.push(
        outcome(appRow.id, appRow.name, "skipped", null, "Has a custom icon (not overwritten)"),
      );
      continue;
    }

    try {
      updateApp(appRow.id, { icon: ref });
      outcomes.push(outcome(appRow.id, appRow.name, "applied", ref, null));
    } catch (err) {
      outcomes.push(
        outcome(
          appRow.id,
          appRow.name,
          "failed",
          null,
          err instanceof Error ? err.message : "Failed to update app",
        ),
      );
    }
  }

  return {
    applied: outcomes.filter((o) => o.status === "applied").length,
    skipped: outcomes.filter((o) => o.status === "skipped").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    outcomes,
  };
}

function outcome(
  appId: number,
  name: string,
  status: PackMatchOutcomeDTO["status"],
  icon: string | null,
  message: string | null,
): PackMatchOutcomeDTO {
  return { appId, name, status, icon, message };
}
