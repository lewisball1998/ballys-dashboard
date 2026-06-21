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
 *   anything else non-empty→ legacy raw value, used as-is (back-compat)
 *
 * Pure + framework-free so it is unit-testable and shared by client + server.
 */

const BUILTIN_PREFIX = "builtin:";
const CUSTOM_PREFIX = "custom:";
const VARIANTS: readonly IconVariant[] = ["light", "dark", "4k", "alt"];

/** Public URL of a built-in asset (Next serves /public at the web root). */
export const BUILTIN_BASE_PATH = "/icons/builtin/";
/** Custom uploads are served by opaque id only — never a filesystem path. */
export function customIconUrl(id: string): string {
  return `/api/icons/${id}/raw`;
}

/** Build a reference string for a built-in icon (+ optional explicit variant). */
export function buildBuiltinRef(key: string, variant?: IconVariant | null): string {
  return variant ? `${BUILTIN_PREFIX}${key}?v=${variant}` : `${BUILTIN_PREFIX}${key}`;
}

/** Build a reference string for an uploaded custom icon. */
export function buildCustomRef(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
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
