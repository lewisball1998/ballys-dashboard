/**
 * User icon-pack manifest schema + import limits (v0.2.8). ⭐ Pure: zod + plain
 * helpers only, so it is shared by the server importer and unit-tested in node.
 *
 * An imported pack is fully UNTRUSTED user input. This module owns the manifest
 * contract and the size/path rules; the ZIP/byte-level safety lives in
 * `@/server/icons/pack-import`. PNG/WebP only — SVG is never accepted (it can
 * carry script/external refs) and there is no remote/URL import. See ADR 0014.
 */
import { z } from "zod";
import { PACK_ID_RE, PACK_ICON_KEY_RE, PACK_VARIANT_RE } from "./resolve";

/** Hard cap on the uploaded `.zip` itself (5 MB), checked before any inflation. */
export const MAX_PACK_ZIP_BYTES = 5 * 1024 * 1024;
/** Total uncompressed bytes across all referenced assets (zip-bomb guard, 16 MB). */
export const MAX_PACK_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
/** Max archive entries (also rejects the zip64 entry-count sentinel). */
export const MAX_PACK_ENTRIES = 600;
/** Max icons declared by a manifest. */
export const MAX_ICONS_PER_PACK = 512;
/** Max size of the manifest.json entry. */
export const MAX_MANIFEST_BYTES = 256 * 1024;
/** Per-asset cap, shared with custom uploads (512 KB). */
export { MAX_ICON_BYTES } from "./upload";

/** Canonical, root-level manifest filename inside the archive. */
export const MANIFEST_NAME = "manifest.json";

/**
 * A safe, `assets/`-rooted relative path inside the archive. Rejects traversal
 * (`..`), absolute paths, backslashes, Windows drive letters, NUL bytes and any
 * entry that is not under `assets/`. Each segment is a conservative slug.
 */
export function isSafeAssetPath(p: unknown): p is string {
  if (typeof p !== "string") return false;
  if (p.length === 0 || p.length > 255) return false;
  if (p.includes("\0") || p.includes("\\")) return false;
  if (p.startsWith("/")) return false; // absolute (POSIX)
  if (/^[A-Za-z]:/.test(p)) return false; // Windows drive letter
  if (!p.startsWith("assets/")) return false;
  const segments = p.split("/");
  if (segments.length < 2) return false; // must be assets/<file...>
  return segments.every(
    (s) => s.length > 0 && s !== "." && s !== ".." && /^[A-Za-z0-9._-]+$/.test(s),
  );
}

const slug = (re: RegExp, max: number, label: string) =>
  z.string().trim().min(1).max(max).regex(re, label);

const assetPath = z.string().trim().refine(isSafeAssetPath, "Unsafe or non-asset file path");

const iconSchema = z.object({
  key: slug(PACK_ICON_KEY_RE, 64, "Invalid icon key"),
  label: z.string().trim().min(1).max(120).optional(),
  file: assetPath,
  /** Optional explicit variants: variant slug → asset path. */
  variants: z
    .record(z.string().trim().min(1).max(32).regex(PACK_VARIANT_RE, "Invalid variant"), assetPath)
    .optional(),
});

/** `manifest.json` (manifestVersion 1). */
export const iconPackManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    id: slug(PACK_ID_RE, 64, "Invalid pack id"),
    name: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(40),
    author: z.string().trim().min(1).max(120).optional(),
    license: z.string().trim().min(1).max(120).optional(),
    // Display/link only — NEVER fetched by the server.
    homepage: z
      .string()
      .trim()
      .max(2048)
      .refine((u) => /^https?:\/\//i.test(u), "homepage must be an http(s) URL")
      .optional(),
    icons: z.array(iconSchema).min(1).max(MAX_ICONS_PER_PACK),
  })
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    for (const icon of m.icons) {
      if (seen.has(icon.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate icon key: ${icon.key}`,
          path: ["icons"],
        });
      }
      seen.add(icon.key);
    }
  });

export type IconPackManifest = z.infer<typeof iconPackManifestSchema>;

/** Validate parsed JSON against the manifest schema, returning a flat result. */
export function parseManifest(
  json: unknown,
): { ok: true; manifest: IconPackManifest } | { ok: false; error: string } {
  const res = iconPackManifestSchema.safeParse(json);
  if (!res.success) return { ok: false, error: res.error.issues[0]?.message ?? "Invalid manifest" };
  return { ok: true, manifest: res.data };
}
