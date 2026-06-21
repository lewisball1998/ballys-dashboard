/**
 * Imported icon-pack → app matching engine (v0.2.9). ⭐ Pure, framework-free and
 * DB-free, so it is shared by the review UI and unit-tested in node.
 *
 * Given the existing apps and one imported pack, suggest which pack icon best
 * fits each app — with a confidence tier and a short human reason — so the user
 * can review, tick/untick and override before ANY app icon is changed. Nothing
 * here writes; matches are only ever *offered* (the server applies the user's
 * vetted, explicit selection — see server/services/icon-packs.applyPackMatches).
 *
 * Scoring reuses the same exact > contains > reverse-contains tiers and
 * qualifier-stripping as the built-in suggester (./match-core), so a pack icon
 * keyed `sonarr` matches an app named "Sonarr 4K" and a `sonarr-4k` icon matches
 * an app named "Sonarr" — qualifier stripping works in both directions.
 */
import type { AppDTO, IconPackDTO, IconPackIconDTO } from "@/lib/types";
import { buildPackRef, parseIconRef } from "./resolve";
import { normalize, safeHost, scoreAlias, strippedName } from "./match-core";

export type MatchConfidence = "high" | "medium" | "low";

export interface PackMatchSuggestion {
  appId: number;
  appName: string;
  appUrl: string;
  /** The app's current icon reference (may be null/empty = initials). */
  currentIcon: string | null;
  /**
   * The app already has an explicit icon that is NOT this exact suggestion, so
   * applying would replace it. Protected: the row is unticked by default and the
   * user must opt in via "replace existing icons" (also re-enforced server-side).
   */
  currentIsCustomised: boolean;
  /** The app already uses exactly this suggested pack ref — applying is a no-op. */
  alreadySet: boolean;
  /** Suggested icon key within the pack. */
  iconKey: string;
  /** Display label for the suggested icon. */
  iconLabel: string;
  /** Raw score 1–3 (internal/tunable); always > 0 for a returned suggestion. */
  score: number;
  confidence: MatchConfidence;
  /** Short, user-facing explanation of why this icon was suggested. */
  reason: string;
  /** Whether the review row should start ticked (never true for protected rows). */
  defaultSelected: boolean;
}

/** Confidence tier for a raw score. */
function confidenceFor(score: number): MatchConfidence {
  if (score >= 3) return "high";
  if (score === 2) return "medium";
  return "low";
}

/**
 * Candidate strings an icon can match on: its key and label, plus their
 * qualifier-stripped forms (so `sonarr-4k` also matches "Sonarr"). Deduped; empty
 * strings dropped. `scoreAlias` re-normalises each, so casing/punctuation here is
 * irrelevant.
 */
function iconCandidates(icon: IconPackIconDTO): string[] {
  const out = new Set<string>();
  if (icon.key) {
    out.add(icon.key);
    out.add(strippedName(icon.key));
  }
  if (icon.label) {
    out.add(icon.label);
    out.add(strippedName(icon.label));
  }
  out.delete("");
  return [...out];
}

/** Human reason for the winning candidate/score. */
function reasonFor(candidate: string, n: string, host: string, score: number): string {
  const a = normalize(candidate);
  if (score >= 3) return "Exact name match";
  if (score === 2) {
    if (n && n.includes(a)) return `App name contains "${candidate}"`;
    return `URL address matches "${candidate}"`;
  }
  return `Icon "${candidate}" matches the app name`;
}

interface BestMatch {
  icon: IconPackIconDTO;
  candidate: string;
  score: number;
  len: number;
}

/** Best icon in the pack for one app, or null when nothing scores. */
function bestIconForApp(app: AppDTO, pack: IconPackDTO, n: string, host: string): BestMatch | null {
  let best: BestMatch | null = null;
  for (const icon of pack.icons) {
    for (const candidate of iconCandidates(icon)) {
      const score = scoreAlias(candidate, n, host);
      if (score === 0) continue;
      const len = normalize(candidate).length;
      // Higher score wins; ties broken by the longer (more specific) candidate,
      // then by pack icon order (the first icon seen keeps the lead on a full tie).
      if (!best || score > best.score || (score === best.score && len > best.len)) {
        best = { icon, candidate, score, len };
      }
    }
  }
  return best;
}

/**
 * Suggest pack icons for the given apps. Returns one suggestion per app that has
 * a positive match, newest-strongest first (score desc, then name). Apps with no
 * match are omitted — the user can still assign those manually via the picker.
 */
export function matchPackToApps(apps: AppDTO[], pack: IconPackDTO): PackMatchSuggestion[] {
  const suggestions: PackMatchSuggestion[] = [];

  for (const app of apps) {
    const n = strippedName(app.name);
    const host = normalize(safeHost(app.url));
    if (!n && !host) continue;

    const best = bestIconForApp(app, pack, n, host);
    if (!best) continue;

    const iconKey = best.icon.key;
    const suggestedRef = buildPackRef(pack.id, iconKey);
    const current = (app.icon ?? "").trim();
    const alreadySet = current === suggestedRef;
    const hasIcon = parseIconRef(current).kind !== "none";
    const currentIsCustomised = hasIcon && !alreadySet;
    const confidence = confidenceFor(best.score);

    suggestions.push({
      appId: app.id,
      appName: app.name,
      appUrl: app.url,
      currentIcon: app.icon ?? null,
      currentIsCustomised,
      alreadySet,
      iconKey,
      iconLabel: best.icon.label ?? iconKey,
      score: best.score,
      confidence,
      reason: reasonFor(best.candidate, n, host, best.score),
      // Only auto-tick a confident match onto an app with no existing icon.
      defaultSelected:
        !alreadySet && !currentIsCustomised && (confidence === "high" || confidence === "medium"),
    });
  }

  suggestions.sort((a, b) => b.score - a.score || a.appName.localeCompare(b.appName));
  return suggestions;
}
