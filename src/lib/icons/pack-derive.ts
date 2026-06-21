/**
 * Filename → icon-key / label derivation for *manifestless* icon packs (v0.2.8.1).
 * ⭐ Pure: no node, no zod — shared by the importer and unit-tested.
 *
 * A "flat" pack is a `.zip` of PNG/WebP files (at the root or under `assets/`)
 * with NO `manifest.json`. We synthesise a manifest from the filenames: each
 * file's basename (minus extension) becomes a strict icon-key slug plus a
 * humanised label. This is display-string handling only — no logos/assets.
 */
import { PACK_ID_RE } from "./resolve";

/** Lowercase a string into a strict pack/icon slug (`a-z0-9` + single hyphens), or "" if empty. */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Cap to the 64-char slug limit, then re-trim any hyphen left dangling by the cut.
  return s.slice(0, 64).replace(/-+$/g, "");
}

/** Strip directory + a trailing `.png`/`.webp` extension, returning the basename stem. */
function basenameStem(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.(png|webp)$/i, "");
}

/** Derive a strict icon key from an image entry path (`Sonarr-4K.png` → `sonarr-4k`). */
export function deriveIconKey(path: string): string {
  return slugify(basenameStem(path));
}

/**
 * Known display names where plain title-casing reads wrong. Display strings only
 * (no images/logos). The default humaniser handles everything else, so this stays
 * a small convenience map — not an exhaustive registry.
 */
const KNOWN_LABELS: Record<string, string> = {
  truenas: "TrueNAS",
  freenas: "FreeNAS",
  pfsense: "pfSense",
  opnsense: "OPNsense",
  qbittorrent: "qBittorrent",
  pihole: "Pi-hole",
  freshrss: "FreshRSS",
  searxng: "SearXNG",
  linkwarden: "Linkwarden",
  uptimekuma: "Uptime Kuma",
  homeassistant: "Home Assistant",
  nextcloud: "Nextcloud",
  paperlessngx: "Paperless-ngx",
  vaultwarden: "Vaultwarden",
  homebridge: "Homebridge",
  jellyfin: "Jellyfin",
};

/** Per-token casing for common acronyms / quality qualifiers. */
const TOKEN_LABELS: Record<string, string> = {
  "4k": "4K",
  "8k": "8K",
  uhd: "UHD",
  hd: "HD",
  sd: "SD",
  hdr: "HDR",
  ui: "UI",
  api: "API",
  rss: "RSS",
  ip: "IP",
  dns: "DNS",
  vpn: "VPN",
  nas: "NAS",
  db: "DB",
  sql: "SQL",
  ai: "AI",
  tv: "TV",
  pdf: "PDF",
  ssh: "SSH",
};

/** Humanise an icon key into a display label (`nginx-proxy-manager` → `Nginx Proxy Manager`). */
export function humanizeLabel(key: string): string {
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];
  return key
    .split("-")
    .filter(Boolean)
    .map((t) => TOKEN_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}

/** Derive a pack-id slug from a `.zip` filename, or null when nothing usable remains. */
export function derivePackId(zipName: string | null | undefined): string | null {
  if (!zipName) return null;
  const stem = zipName.slice(zipName.lastIndexOf("/") + 1).replace(/\.zip$/i, "");
  const slug = slugify(stem);
  return slug.length >= 1 && PACK_ID_RE.test(slug) ? slug : null;
}

/** Derive a human pack name from a `.zip` filename, with a safe default. */
export function derivePackName(zipName: string | null | undefined): string {
  const id = derivePackId(zipName);
  return id ? humanizeLabel(id) : "Imported Icons";
}
