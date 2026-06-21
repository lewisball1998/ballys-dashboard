import { BUILTIN_ICONS } from "./registry";
import { normalize, safeHost, scoreAlias, strippedName } from "./match-core";

/**
 * Pure name/url → built-in icon-key suggestion (v0.2.6). Used by the icon picker
 * to *offer* a sensible default; callers must never apply it over an explicit
 * user choice. Deterministic: prefers the longest alias match (so "db" never wins
 * over a real token), falling back to registry order on ties.
 *
 * The normalisation + scoring primitives live in ./match-core (v0.2.9) and are
 * shared with the imported-pack matcher; this module's behaviour is unchanged.
 */

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
