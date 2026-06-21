import type { IconTheme, IconVariant, ParsedIconRef, ResolvedIcon } from "./types";
import { getBuiltinIcon } from "./registry";

/**
 * Icon reference grammar (stored in the existing `apps.icon` TEXT column):
 *
 *   null / ""              → initials fallback
 *   http(s)://…            → remote URL (existing behaviour, preserved)
 *   builtin:<key>          → built-in registry icon
 *   builtin:<key>?v=<var>  → built-in icon, explicit variant (4k/alt/…)
 *   custom:<id>            → uploaded custom icon (served by opaque id)
 *   pack:<packId>/<key>    → imported icon-pack icon (v0.2.8)
 *   pack:<packId>/<key>?v=<variant>
 *                          → imported pack icon, explicit variant
 *   anything else non-empty→ legacy raw value, used as-is (back-compat)
 *
 * Pure + framework-free so it is unit-testable and shared by client + server.
 */

const BUILTIN_PREFIX = "builtin:";
const CUSTOM_PREFIX = "custom:";
const PACK_PREFIX = "pack:";
const VARIANTS: readonly IconVariant[] = ["light", "dark", "4k", "alt"];

/**
 * Slug grammar for imported packs (v0.2.8): lowercase alphanumeric with single
 * internal hyphens. Single-sourced here (pure, zero-dependency) and reused by the
 * manifest validator and the API route param schemas.
 */
const PACK_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PACK_ID_RE = PACK_SLUG_RE;
export const PACK_ICON_KEY_RE = PACK_SLUG_RE;
export const PACK_VARIANT_RE = PACK_SLUG_RE;

export function isValidPackId(id: string): boolean {
  return id.length >= 1 && id.length <= 64 && PACK_ID_RE.test(id);
}
export function isValidPackIconKey(key: string): boolean {
  return key.length >= 1 && key.length <= 64 && PACK_ICON_KEY_RE.test(key);
}
export function isValidPackVariant(variant: string): boolean {
  return variant.length >= 1 && variant.length <= 32 && PACK_VARIANT_RE.test(variant);
}

/** Public URL of a built-in asset (Next serves /public at the web root). */
export const BUILTIN_BASE_PATH = "/icons/builtin/";
/** Custom uploads are served by opaque id only — never a filesystem path. */
export function customIconUrl(id: string): string {
  return `/api/icons/${id}/raw`;
}
/** Pack icons are served by (packId, key) only — never a filesystem path. */
export function packIconUrl(packId: string, iconKey: string, variant?: string | null): string {
  const base = `/api/icons/packs/${encodeURIComponent(packId)}/${encodeURIComponent(iconKey)}/raw`;
  return variant ? `${base}?v=${encodeURIComponent(variant)}` : base;
}

/** Build a reference string for a built-in icon (+ optional explicit variant). */
export function buildBuiltinRef(key: string, variant?: IconVariant | null): string {
  return variant ? `${BUILTIN_PREFIX}${key}?v=${variant}` : `${BUILTIN_PREFIX}${key}`;
}

/** Build a reference string for an uploaded custom icon. */
export function buildCustomRef(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
}

/** Build a reference string for an imported pack icon (+ optional variant). */
export function buildPackRef(packId: string, iconKey: string, variant?: string | null): string {
  const base = `${PACK_PREFIX}${packId}/${iconKey}`;
  return variant ? `${base}?v=${variant}` : base;
}

/** Opaque custom-icon ids are hex tokens; reject anything else defensively. */
const CUSTOM_ID_RE = /^[a-f0-9]{8,64}$/i;
export function isValidCustomId(id: string): boolean {
  return CUSTOM_ID_RE.test(id);
}

function parseVariant(raw: string): IconVariant | null {
  const v = raw.toLowerCase();
  return (VARIANTS as readonly string[]).includes(v) ? (v as IconVariant) : null;
}

/** Parse an icon reference string into a discriminated union. */
export function parseIconRef(value: string | null | undefined): ParsedIconRef {
  const v = (value ?? "").trim();
  if (v === "") return { kind: "none" };
  if (/^https?:\/\//i.test(v)) return { kind: "url", url: v };

  if (v.toLowerCase().startsWith(BUILTIN_PREFIX)) {
    const rest = v.slice(BUILTIN_PREFIX.length);
    const [rawKey, query] = rest.split("?", 2);
    let variant: IconVariant | null = null;
    if (query) {
      const params = new URLSearchParams(query);
      const vParam = params.get("v");
      if (vParam) variant = parseVariant(vParam);
    }
    return { kind: "builtin", key: (rawKey ?? "").trim(), variant };
  }

  if (v.toLowerCase().startsWith(CUSTOM_PREFIX)) {
    return { kind: "custom", id: v.slice(CUSTOM_PREFIX.length).trim() };
  }

  if (v.toLowerCase().startsWith(PACK_PREFIX)) {
    const rest = v.slice(PACK_PREFIX.length);
    const [rawPath, query] = rest.split("?", 2);
    const path = rawPath ?? "";
    const slash = path.indexOf("/");
    const packId = (slash >= 0 ? path.slice(0, slash) : path).trim();
    const iconKey = (slash >= 0 ? path.slice(slash + 1) : "").trim();
    let variant: string | null = null;
    if (query) {
      const vParam = new URLSearchParams(query).get("v");
      if (vParam) variant = vParam.trim();
    }
    return { kind: "pack", packId, iconKey, variant };
  }

  return { kind: "legacy", value: v };
}

/**
 * Resolve an icon reference into a render instruction. Unknown built-in keys and
 * malformed custom ids degrade to {mode:"initials"} so callers always have a safe
 * fallback. `theme` only matters when a built-in declares light/dark variants.
 */
export function resolveIconSrc(
  value: string | null | undefined,
  opts: { theme?: IconTheme } = {},
): ResolvedIcon {
  const ref = parseIconRef(value);
  switch (ref.kind) {
    case "none":
      return { mode: "initials" };
    case "url":
      return { mode: "img", src: ref.url };
    case "legacy":
      // Preserve existing behaviour: legacy values were used directly as <img src>.
      return { mode: "img", src: ref.value };
    case "custom":
      return isValidCustomId(ref.id)
        ? { mode: "img", src: customIconUrl(ref.id) }
        : { mode: "initials" };
    case "pack": {
      // Pack icons always render via <img> (never mask); a missing pack/icon
      // 404s and the AppIcon onError handler falls back to initials. An invalid
      // variant slug is dropped so the base icon is served.
      if (!isValidPackId(ref.packId) || !isValidPackIconKey(ref.iconKey)) {
        return { mode: "initials" };
      }
      const variant = ref.variant && isValidPackVariant(ref.variant) ? ref.variant : null;
      return { mode: "img", src: packIconUrl(ref.packId, ref.iconKey, variant) };
    }
    case "builtin": {
      const icon = getBuiltinIcon(ref.key);
      if (!icon) return { mode: "initials" };
      // explicit variant > theme variant > base file
      const themeVariant = opts.theme ? icon.variants?.[opts.theme] : undefined;
      const file = (ref.variant && icon.variants?.[ref.variant]) || themeVariant || icon.file;
      const src = `${BUILTIN_BASE_PATH}${file}`;
      return { mode: icon.monochrome ? "mask" : "img", src };
    }
  }
}
