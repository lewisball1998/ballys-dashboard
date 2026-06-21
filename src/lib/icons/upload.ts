/**
 * Custom icon upload constraints + magic-byte sniffing (v0.2.6). Pure: operates
 * on bytes, so it is shared by the server route and unit-tested in node.
 *
 * v0.2.6 accepts PNG and WebP only. User-uploaded SVG is intentionally NOT
 * accepted (it can carry script/external refs); built-in first-party SVGs are
 * fine because they are reviewed repo assets. See ADR 0013.
 */

/** Hard size cap for an uploaded icon (512 KB). */
export const MAX_ICON_BYTES = 512 * 1024;

/** Supported upload types → canonical mime. */
export const ALLOWED_ICON_TYPES = {
  png: "image/png",
  webp: "image/webp",
} as const;

export type IconImageType = keyof typeof ALLOWED_ICON_TYPES;

export function mimeForType(type: IconImageType): string {
  return ALLOWED_ICON_TYPES[type];
}

/** File extension stored on disk for a sniffed type. */
export function extForType(type: IconImageType): string {
  return type;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Identify an image by its magic bytes (NOT the client-declared content-type).
 * Returns the supported type or null. PNG = 8-byte signature; WebP = "RIFF"
 * ....  "WEBP".
 */
export function sniffImageType(bytes: Uint8Array): IconImageType | null {
  if (bytes.length >= 8 && PNG_MAGIC.every((b, i) => bytes[i] === b)) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }
  return null;
}
