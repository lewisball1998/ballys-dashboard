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
    if (n && a.includes(n)) return 1;
  }
  return 0;
}

/** Suggest a built-in icon key for an app name (and optional URL), or null. */
export function suggestIconKey(name: string, url?: string | null): string | null {
  const n = normalize(name);
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
