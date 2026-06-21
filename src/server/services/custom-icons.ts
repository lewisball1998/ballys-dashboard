import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customIcons } from "@/db/schema";
import type { CustomIconRow } from "@/db/schema";
import type { CustomIconDTO } from "@/lib/types";
import { extForType, mimeForType, type IconImageType } from "@/lib/icons/upload";
import {
  deleteIconFile,
  generateIconId,
  readIconFile,
  sha256Hex,
  writeIconFile,
} from "@/server/icons/storage";

function toDTO(row: CustomIconRow): CustomIconDTO {
  return {
    id: row.id,
    mime: row.mime,
    bytes: row.bytes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** All custom icons, newest first. */
export function listCustomIcons(): CustomIconDTO[] {
  return db.select().from(customIcons).orderBy(desc(customIcons.createdAt)).all().map(toDTO);
}

/**
 * Persist validated image bytes. Deduplicates by sha256: an identical re-upload
 * returns the existing icon (no second file written).
 */
export function createCustomIcon(bytes: Buffer, type: IconImageType): CustomIconDTO {
  const sha = sha256Hex(bytes);
  const existing = db.select().from(customIcons).where(eq(customIcons.sha256, sha)).get();
  if (existing) return toDTO(existing);

  const id = generateIconId();
  const ext = extForType(type);
  writeIconFile(id, ext, bytes);

  const row = db
    .insert(customIcons)
    .values({
      id,
      mime: mimeForType(type),
      ext,
      bytes: bytes.length,
      sha256: sha,
      createdAt: new Date(),
    })
    .returning()
    .get();
  return toDTO(row);
}

/** Raw bytes + mime for serving, or null when the row/file is missing. */
export function getCustomIconBytes(id: string): { bytes: Buffer; mime: string } | null {
  const row = db.select().from(customIcons).where(eq(customIcons.id, id)).get();
  if (!row) return null;
  const bytes = readIconFile(row.id, row.ext);
  if (!bytes) return null;
  return { bytes, mime: row.mime };
}

/** Delete a custom icon (row + file). Returns false when it does not exist. */
export function deleteCustomIcon(id: string): boolean {
  const row = db.select().from(customIcons).where(eq(customIcons.id, id)).get();
  if (!row) return false;
  deleteIconFile(row.id, row.ext);
  db.delete(customIcons).where(eq(customIcons.id, id)).run();
  return true;
}
