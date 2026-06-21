import { BUILTIN_ICONS } from "./registry";

/**
 * Pure name/url → built-in icon-key suggestion (v0.2.6). Used by the icon picker
 * to *offer* a sensible default; callers must never apply it over an explicit
 * user choice. Deterministic: prefers the longest alias match (so "db" never wins
 * over a real token), falling back to registry order on ties.
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Qualifier tokens dropped from an app name before matching, so quality-suffixed
 * and multi-instance names map to the same base icon (e.g. "Sonarr 4K" → media,
 * "Radarr Anime" → media, "Sonarr 2" → media). Token-based (whole words only) so
 * substrings inside real names are never removed (e.g. "hd" inside "HDHomeRun").
 */
const QUALIFIER_TOKENS = new Set([
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
 * match. Returns the same shape as `normalize()` (lowercase alphanumeric, joined).
 */
function strippedName(name: string): string {
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
function scoreAlias(alias: string, n: string, host: string): number {
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

/** Suggest a built-in icon key for an app name (and optional URL), or null. */
export function suggestIconKey(name: string, url?: string | null): string | null {
  const n = strippedName(name);
  const host = url ? normalize(safeHost(url)) : "";
  if (!n && !host) return null;

  let best: string | null = null;
  let bestScore = 0;
  let bestLen = 0;

  for (const icon of BUILTIN_ICONS) {
    for (const candidate of [icon.key, ...icon.aliases]) {
      const score = scoreAlias(candidate, n, host);
      if (score === 0) continue;
      const len = normalize(candidate).length;
      // Higher score wins; ties broken by the longer (more specific) alias.
      // Strict comparisons keep the earlier registry icon on a full tie.
      if (score > bestScore || (score === bestScore && len > bestLen)) {
        best = icon.key;
        bestScore = score;
        bestLen = len;
      }
    }
  }
  return best;
}
