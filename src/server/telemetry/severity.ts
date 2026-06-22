import type { HealthSeverity } from "@/lib/types";

/**
 * Pure severity classification for infrastructure telemetry (v0.3.0). No I/O —
 * unit tested. The golden rule: missing/unknown data is `unavailable`, which is
 * a calm state and NEVER treated as critical unless there is real evidence of
 * failure.
 */

/** Temperature thresholds (°C) per the v0.3.0 brief. */
export const TEMP_WARNING_C = 45;
export const TEMP_CRITICAL_C = 55;

/** Default capacity thresholds (%) when a caller has no configured override. */
export const CAPACITY_WARNING_PCT = 80;
export const CAPACITY_CRITICAL_PCT = 90;

/** Classify a temperature reading. `null`/non-finite → unavailable (not a fault). */
export function temperatureSeverity(celsius: number | null | undefined): HealthSeverity {
  if (celsius === null || celsius === undefined || !Number.isFinite(celsius)) return "unavailable";
  if (celsius >= TEMP_CRITICAL_C) return "critical";
  if (celsius >= TEMP_WARNING_C) return "warning";
  return "healthy";
}

/**
 * Classify a usage/capacity percentage. `warning` defaults to the configured
 * notification threshold; `critical` is a higher band. Unknown → unavailable.
 */
export function capacitySeverity(
  percent: number | null | undefined,
  warning = CAPACITY_WARNING_PCT,
  critical = CAPACITY_CRITICAL_PCT,
): HealthSeverity {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return "unavailable";
  // Keep critical strictly above warning even if a caller passes warning >= critical.
  const crit = Math.max(critical, warning);
  if (percent >= crit) return "critical";
  if (percent >= warning) return "warning";
  return "healthy";
}

/** Severity ordering for aggregation (higher = worse). */
const RANK: Record<HealthSeverity, number> = {
  unavailable: 0,
  healthy: 1,
  warning: 2,
  critical: 3,
};

/**
 * Combine child severities into a parent. `unavailable` is the weakest signal:
 * it only wins when there is nothing else to report, so a healthy resource with
 * one unavailable sub-reading still reads healthy.
 */
export function worstSeverity(severities: HealthSeverity[]): HealthSeverity {
  if (severities.length === 0) return "unavailable";
  let worst: HealthSeverity = "unavailable";
  for (const s of severities) {
    if (RANK[s] > RANK[worst]) worst = s;
  }
  return worst;
}

/** True when a severity should raise an alert (real issues only). */
export function isAlertable(severity: HealthSeverity): severity is "warning" | "critical" {
  return severity === "warning" || severity === "critical";
}
