import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { env } from "@/lib/env";

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
