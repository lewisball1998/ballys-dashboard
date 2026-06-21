import { randomBytes } from "node:crypto";
import { unzipSync } from "fflate";
import { sniffImageType, extForType, mimeForType } from "@/lib/icons/upload";
import {
  isAcceptableImageEntry,
  parseManifest,
  MANIFEST_NAME,
  MAX_PACK_ZIP_BYTES,
  MAX_PACK_ICON_BYTES,
  MAX_PACK_UNCOMPRESSED_BYTES,
  MAX_PACK_ENTRIES,
  MAX_MANIFEST_BYTES,
  MAX_ICONS_PER_PACK,
  type IconPackManifest,
} from "@/lib/icons/pack-manifest";
import {
  deriveIconKey,
  derivePackId,
  derivePackName,
  humanizeLabel,
} from "@/lib/icons/pack-derive";
import { sha256Hex } from "@/server/icons/storage";

/**
 * Server-side icon-pack import (v0.2.8, relaxed UX in v0.2.8.1). Takes an
 * UNTRUSTED `.zip`, validates it at the archive, manifest and asset-byte levels,
 * and produces an in-memory, ready-to-persist pack. Writes nothing — the service
 * stages/commits.
 *
 * Two accepted layouts:
 *  - **Strict manifest:** a root `manifest.json` (authoritative) + `assets/` PNG/WebP.
 *  - **Flat / manifestless:** PNG/WebP files at the root and/or under `assets/`,
 *    with NO manifest — a manifest is synthesised from the filenames.
 *
 * Defence layers, cheapest first:
 *  1. total zip-size cap (before any parsing);
 *  2. central-directory scan: entry count + reject symlinks/special files;
 *  3. fflate `filter`: allowlist (manifest.json + root/assets PNG/WebP only),
 *     per-entry and running DECLARED uncompressed caps (skip before inflate);
 *  4. manifest parse+validate (strict mode) or filename-derived synthesis (flat);
 *  5. per-asset ACTUAL-byte checks: magic-byte sniff (PNG/WebP only — SVG/GIF/
 *     JPEG/ICO/empty/malformed rejected), size cap, running total cap, sha256.
 */

/** Typed import failure carrying the API error code + HTTP status. */
export class PackImportError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PackImportError";
    this.code = code;
    this.status = status;
  }
}

export interface PreparedPackIcon {
  key: string;
  label: string | null;
  /** null = base icon. */
  variant: string | null;
  sha256: string;
  ext: string;
  mime: string;
  bytes: number;
}

export interface PreparedPack {
  manifest: IconPackManifest;
  icons: PreparedPackIcon[];
  /** `<sha>.<ext>` → bytes; deduped, ready to write under packs/<id>/. */
  assets: Map<string, Buffer>;
  /** Total deduped bytes that will be stored on disk. */
  storedBytes: number;
}

const EOCD_SIG = 0x06054b50; // PK\x05\x06 end-of-central-directory
const CDH_SIG = 0x02014b50; // PK\x01\x02 central-directory file header

/** Locate the End Of Central Directory record (scans back over the comment). */
function findEocd(b: Buffer): number {
  if (b.length < 22) return -1;
  const minPos = Math.max(0, b.length - (22 + 0xffff));
  for (let i = b.length - 22; i >= minPos; i--) {
    if (b.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

/**
 * Walk the central directory to (a) bound the entry count and (b) reject any
 * entry that is a symlink or other non-regular/non-directory node (detectable
 * via the Unix `st_mode` stored in the high 16 bits of the external attributes
 * when the archive was created on a Unix host). The zip64 entry-count sentinel
 * (0xffff) exceeds MAX_PACK_ENTRIES and is therefore rejected here too.
 */
function assertNoUnsafeZipEntries(b: Buffer): void {
  const eocd = findEocd(b);
  if (eocd < 0) throw new PackImportError("malformed_zip", "Not a valid zip archive");
  const totalEntries = b.readUInt16LE(eocd + 10);
  if (totalEntries > MAX_PACK_ENTRIES) {
    throw new PackImportError(
      "too_many_entries",
      `Archive has too many entries (max ${MAX_PACK_ENTRIES})`,
    );
  }
  let off = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < totalEntries; n++) {
    if (off + 46 > b.length || b.readUInt32LE(off) !== CDH_SIG) {
      throw new PackImportError("malformed_zip", "Corrupt central directory");
    }
    const hostOs = b.readUInt16LE(off + 4) >> 8;
    const externalAttrs = b.readUInt32LE(off + 38);
    if (hostOs === 3) {
      // Unix: top nibble of st_mode is the file type.
      const fmt = (externalAttrs >>> 16) & 0xffff & 0xf000;
      const REG = 0x8000;
      const DIR = 0x4000;
      if (fmt !== 0 && fmt !== REG && fmt !== DIR) {
        throw new PackImportError("unsafe_entry", "Archive contains a symlink or special file");
      }
    }
    const fnameLen = b.readUInt16LE(off + 28);
    const extraLen = b.readUInt16LE(off + 30);
    const commentLen = b.readUInt16LE(off + 32);
    off += 46 + fnameLen + extraLen + commentLen;
  }
}

/**
 * Validate + decode an untrusted `.zip` into a ready-to-persist pack. `zipName`
 * (the uploaded filename) seeds the pack id/name for a manifestless flat zip.
 */
export function preparePackFromZip(zipBytes: Buffer, zipName?: string | null): PreparedPack {
  if (zipBytes.length === 0) throw new PackImportError("empty_file", "Uploaded file is empty");
  if (zipBytes.length > MAX_PACK_ZIP_BYTES) {
    throw new PackImportError(
      "pack_too_large",
      `Pack exceeds the ${Math.floor(MAX_PACK_ZIP_BYTES / 1024 / 1024)} MB limit`,
    );
  }

  assertNoUnsafeZipEntries(zipBytes);

  // Inflate, but skip directory entries, reject anything that is neither
  // manifest.json nor a root/assets PNG/WebP, and reject anything whose DECLARED
  // size blows a cap — those are never decompressed.
  let declaredTotal = 0;
  let rejection: PackImportError | null = null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes, {
      filter(file) {
        if (rejection) return false;
        const { name, originalSize } = file;
        if (name.endsWith("/")) return false; // directory entry
        if (name === MANIFEST_NAME) {
          if (originalSize > MAX_MANIFEST_BYTES) {
            rejection = new PackImportError("manifest_too_large", "manifest.json is too large");
            return false;
          }
          return true;
        }
        if (!isAcceptableImageEntry(name)) {
          rejection = new PackImportError(
            "invalid_entry",
            `Unsupported file in pack: "${name}". Only PNG/WebP icons (at the zip root or under assets/) and an optional manifest.json are allowed.`,
          );
          return false;
        }
        if (originalSize > MAX_PACK_ICON_BYTES) {
          rejection = new PackImportError(
            "asset_too_large",
            `Icon "${name}" exceeds the ${Math.floor(MAX_PACK_ICON_BYTES / 1024 / 1024)} MB per-icon limit`,
          );
          return false;
        }
        declaredTotal += originalSize;
        if (declaredTotal > MAX_PACK_UNCOMPRESSED_BYTES) {
          rejection = new PackImportError(
            "uncompressed_too_large",
            "Pack exceeds the total uncompressed size limit",
          );
          return false;
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof PackImportError) throw error;
    throw new PackImportError("malformed_zip", "Could not read the zip archive");
  }
  if (rejection) throw rejection;

  // Shared ingest: resolve a path against ACTUAL bytes; sniff, cap, dedup.
  const assets = new Map<string, Buffer>();
  const icons: PreparedPackIcon[] = [];
  let actualTotal = 0;

  function ingest(path: string): { sha256: string; ext: string; mime: string; bytes: number } {
    const data = files[path];
    if (!data)
      throw new PackImportError("missing_file", `Referenced file is not in the archive: ${path}`);
    const buf = Buffer.from(data);
    if (buf.length === 0)
      throw new PackImportError("empty_asset", `Referenced file is empty: ${path}`);
    if (buf.length > MAX_PACK_ICON_BYTES)
      throw new PackImportError(
        "asset_too_large",
        `Icon "${path}" exceeds the ${Math.floor(MAX_PACK_ICON_BYTES / 1024 / 1024)} MB per-icon limit`,
      );
    const type = sniffImageType(buf);
    if (!type)
      throw new PackImportError(
        "unsupported_type",
        `Only PNG and WebP icons are supported (SVG is not): ${path}`,
      );
    actualTotal += buf.length;
    if (actualTotal > MAX_PACK_UNCOMPRESSED_BYTES) {
      throw new PackImportError(
        "uncompressed_too_large",
        "Pack exceeds the total uncompressed size limit",
      );
    }
    const sha256 = sha256Hex(buf);
    const ext = extForType(type);
    const stored = `${sha256}.${ext}`;
    if (!assets.has(stored)) assets.set(stored, buf);
    return { sha256, ext, mime: mimeForType(type), bytes: buf.length };
  }

  const manifestRaw = files[MANIFEST_NAME];
  let manifest: IconPackManifest;

  if (manifestRaw) {
    // --- strict mode: manifest.json is authoritative; files live under assets/ ---
    let json: unknown;
    try {
      json = JSON.parse(Buffer.from(manifestRaw).toString("utf8"));
    } catch {
      throw new PackImportError("malformed_manifest", "manifest.json is not valid JSON");
    }
    const parsed = parseManifest(json);
    if (!parsed.ok) throw new PackImportError("invalid_manifest", parsed.error);
    manifest = parsed.manifest;

    for (const icon of manifest.icons) {
      const base = ingest(icon.file);
      icons.push({ key: icon.key, label: icon.label ?? null, variant: null, ...base });
      if (icon.variants) {
        for (const [variant, file] of Object.entries(icon.variants)) {
          const v = ingest(file);
          icons.push({ key: icon.key, label: icon.label ?? null, variant, ...v });
        }
      }
    }
  } else {
    // --- flat / manifestless mode: synthesise a manifest from PNG/WebP filenames ---
    const imageEntries = Object.keys(files)
      .filter((n) => n !== MANIFEST_NAME && isAcceptableImageEntry(n))
      .sort();
    if (imageEntries.length === 0) {
      throw new PackImportError(
        "no_icons",
        "No icons found. Add PNG or WebP files to the .zip (at the root or under assets/), or include a manifest.json.",
      );
    }
    if (imageEntries.length > MAX_ICONS_PER_PACK) {
      throw new PackImportError(
        "too_many_icons",
        `A pack may contain at most ${MAX_ICONS_PER_PACK} icons`,
      );
    }

    const seen = new Map<string, string>(); // key → first source path
    const declared: { key: string; label: string; file: string }[] = [];
    for (const entry of imageEntries) {
      const key = deriveIconKey(entry);
      if (!key) {
        throw new PackImportError(
          "invalid_filename",
          `Could not derive an icon name from "${entry}". Rename it using letters, numbers and hyphens.`,
        );
      }
      const prev = seen.get(key);
      if (prev) {
        throw new PackImportError(
          "duplicate_icon_key",
          `Two files map to the same icon name "${key}" ("${prev}" and "${entry}"). Rename one so each icon name is unique.`,
        );
      }
      seen.set(key, entry);
      declared.push({ key, label: humanizeLabel(key), file: entry });
    }

    manifest = {
      manifestVersion: 1,
      id: derivePackId(zipName) ?? `pack-${randomBytes(4).toString("hex")}`,
      name: derivePackName(zipName),
      version: "1.0.0",
      icons: declared,
    };

    for (const d of declared) {
      const a = ingest(d.file);
      icons.push({ key: d.key, label: d.label, variant: null, ...a });
    }
  }

  let storedBytes = 0;
  for (const buf of assets.values()) storedBytes += buf.length;

  return { manifest, icons, assets, storedBytes };
}
