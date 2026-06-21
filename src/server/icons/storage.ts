import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { env } from "@/lib/env";
import { isValidPackId } from "@/lib/icons/resolve";

/**
 * Filesystem storage for uploaded custom icons. Bytes live on the data volume,
 * in an `icons/` directory derived from the SQLite path (one volume, matching
 * the project's storage model). The client never sees these paths — icons are
 * served by opaque id only.
 *
 * The dir is read from `process.env.ICONS_DIR` at call time (so tests can point
 * it at a temp dir), falling back to a path derived from DATABASE_PATH.
 */
function deriveBaseDir(): string {
  const dbPath = env.DATABASE_PATH;
  const isMemory = dbPath === ":memory:" || dbPath.startsWith("file::memory:");
  if (isMemory) return "./data/icons";
  return join(dirname(dbPath), "icons");
}

export function getIconsDir(): string {
  const override = process.env.ICONS_DIR;
  const base = override && override.trim() !== "" ? override : deriveBaseDir();
  return resolve(base);
}

function ensureIconsDir(): string {
  const dir = getIconsDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fileName(id: string, ext: string): string {
  return `${id}.${ext}`;
}

export function generateIconId(): string {
  return randomBytes(16).toString("hex");
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function writeIconFile(id: string, ext: string, bytes: Buffer): void {
  const dir = ensureIconsDir();
  writeFileSync(join(dir, fileName(id, ext)), bytes);
}

export function readIconFile(id: string, ext: string): Buffer | null {
  const path = join(getIconsDir(), fileName(id, ext));
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function deleteIconFile(id: string, ext: string): void {
  const path = join(getIconsDir(), fileName(id, ext));
  rmSync(path, { force: true });
}

/* ------------------------------------------------------------------ */
/* Imported icon packs (v0.2.8): files under <ICONS_DIR>/packs/<packId>/, named */
/* by sha256 so identical assets dedupe within a pack. The packId is always a   */
/* validated slug before it is used in a path (defence-in-depth below).         */
/* ------------------------------------------------------------------ */

function getPacksDir(): string {
  return join(getIconsDir(), "packs");
}

/** Resolve a pack's directory, asserting the id is a safe slug first. */
function packDirFor(packId: string): string {
  if (!isValidPackId(packId))
    throw new Error(`Refusing to build a path for invalid pack id: ${packId}`);
  return join(getPacksDir(), packId);
}

/**
 * Atomically materialise a pack's assets on disk. Writes every `<sha>.<ext>`
 * file into a throwaway staging dir (on the same volume), then renames it into
 * place as `packs/<packId>/`. On any error nothing is left behind and the final
 * dir is never partially populated. Returns the total bytes written.
 */
export function stagePackAssets(packId: string, assets: Map<string, Buffer>): number {
  const finalDir = packDirFor(packId);
  if (existsSync(finalDir)) throw new Error(`Pack directory already exists: ${packId}`);
  const packsDir = getPacksDir();
  mkdirSync(packsDir, { recursive: true });
  const staging = mkdtempSync(join(packsDir, ".staging-"));
  let total = 0;
  try {
    for (const [name, bytes] of assets) {
      // Stored names are `<sha256>.<ext>` — never a path. Assert it cannot escape.
      if (name.includes("/") || name.includes("\\") || name.includes("..")) {
        throw new Error(`Unsafe stored asset name: ${name}`);
      }
      writeFileSync(join(staging, name), bytes);
      total += bytes.length;
    }
    renameSync(staging, finalDir);
    return total;
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

/** Read a stored pack asset by sha256 + ext, or null when missing. */
export function readPackAsset(packId: string, sha256: string, ext: string): Buffer | null {
  const path = join(packDirFor(packId), fileName(sha256, ext));
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

/** Remove a pack's entire on-disk directory (idempotent). */
export function deletePackDir(packId: string): void {
  rmSync(packDirFor(packId), { recursive: true, force: true });
}
