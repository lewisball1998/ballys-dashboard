/**
 * Shared name/url normalisation + alias scoring (v0.2.9). ⭐ Pure, framework-free.
 *
 * Extracted verbatim from the v0.2.6/0.2.7 built-in suggester so that both the
 * built-in `suggestIconKey` (suggest.ts) and the imported-pack matcher
 * (pack-match.ts) score against ONE implementation — the carefully tuned exact >
 * contains > reverse-contains tiers and the qualifier-stripping behaviour must
 * stay identical (see tests/unit/icon-suggest.test.ts). No behaviour change.
 */

/** Lowercase, strip to bare alphanumerics. The canonical comparison form. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Hostname of a URL, or "" when it does not parse. */
export function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Qualifier tokens dropped from a name before matching, so quality-suffixed and
 * multi-instance names map to the same base icon (e.g. "Sonarr 4K" → media,
 * "Radarr Anime" → media, "Sonarr 2" → media). Token-based (whole words only) so
 * substrings inside real names are never removed (e.g. "hd" inside "HDHomeRun").
 */
export const QUALIFIER_TOKENS = new Set([
  "4k",
  "uhd",
  "hd",
  "sd",
  "1080p",
  "2160p",
  "fhd",
  "anime",
  "kids",
  "remux",
  "x265",
  "hevc",
  "instance",
  "main",
  "alt",
  "secondary",
  "2",
  "3",
]);

/**
 * Normalise a name for matching, dropping standalone qualifier tokens. NEVER
 * strips to empty: a bare "4K"/"Anime" keeps its original tokens so it can still
 * match. Returns the same shape as {@link normalize} (lowercase alphanumeric, joined).
 */
export function strippedName(name: string): string {
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return "";
  const kept = tokens.filter((t) => !QUALIFIER_TOKENS.has(t));
  return (kept.length > 0 ? kept : tokens).join("");
}

/**
 * Score a single alias against the inputs. Higher wins; 0 = no match.
 *   3 exact name match · 2 name/host contains the alias · 1 alias contains name.
 * Exact always beats partial, so "Plex" → media (alias "plex") rather than music
 * (alias "plexamp" which merely contains "plex"). Substring matches need an alias
 * of length >= 3 to avoid noisy two-letter aliases bleeding across names.
 */
export function scoreAlias(alias: string, n: string, host: string): number {
  const a = normalize(alias);
  if (!a) return 0;
  if (n && n === a) return 3;
  if (a.length >= 3) {
    if (n && n.includes(a)) return 2;
    if (host && host.includes(a)) return 2;
    // alias-contains-name is the weakest signal; require a name of >= 3 chars so
    // a short residual (e.g. "hd", "ai") can't bleed into long aliases.
    if (n.length >= 3 && a.includes(n)) return 1;
  }
  return 0;
}
