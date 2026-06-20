import { DEFAULTS, SETTING_KEYS } from "@/lib/constants";
import type { AppSettingsDTO, ThemeMode, AccentColor } from "@/lib/types";
import type { SettingsUpdateInput } from "@/lib/validation";

/**
 * Pure mapping between the `settings` key/value rows and `AppSettingsDTO`.
 * Kept free of DB imports so it is trivially unit-testable.
 */
export type SettingRow = { key: string; value: string | null };

export function rowsToSettings(rows: SettingRow[]): AppSettingsDTO {
  const m = new Map<string, string | null>();
  for (const r of rows) m.set(r.key, r.value);

  const str = (key: string, fallback: string): string => {
    const v = m.get(key);
    return v != null ? v : fallback;
  };
  const num = (key: string, fallback: number): number => {
    const v = m.get(key);
    const n = v != null ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (key: string, fallback: boolean): boolean => {
    const v = m.get(key);
    return v != null ? v === "true" : fallback;
  };

  return {
    dashboardName: str(SETTING_KEYS.dashboardName, DEFAULTS.appearance.dashboardName),
    theme: str(SETTING_KEYS.theme, DEFAULTS.appearance.theme) as ThemeMode,
    accent: str(SETTING_KEYS.accent, DEFAULTS.appearance.accent) as AccentColor,
    timezone: str(SETTING_KEYS.timezone, DEFAULTS.appearance.timezone),
    logoPath: m.get(SETTING_KEYS.logoPath) ?? null,
    authEnabled: bool(SETTING_KEYS.authEnabled, DEFAULTS.authEnabledByDefault),
    setupCompleted: bool(SETTING_KEYS.setupCompleted, false),
    appHealthIntervalMs: num(SETTING_KEYS.appHealthIntervalMs, DEFAULTS.appHealthIntervalMs),
    systemMetricIntervalMs: num(SETTING_KEYS.systemMetricIntervalMs, DEFAULTS.systemMetricIntervalMs),
    metricRetentionDays: num(SETTING_KEYS.metricRetentionDays, DEFAULTS.metricRetentionDays),
    thresholds: {
      cpuPercent: num(SETTING_KEYS.thresholdCpu, DEFAULTS.thresholds.cpuPercent),
      memoryPercent: num(SETTING_KEYS.thresholdMemory, DEFAULTS.thresholds.memoryPercent),
      storagePercent: num(SETTING_KEYS.thresholdStorage, DEFAULTS.thresholds.storagePercent),
    },
  };
}

/** Map a (validated) partial settings update to the kv rows to upsert. */
export function settingsUpdateToRows(input: SettingsUpdateInput): SettingRow[] {
  const rows: SettingRow[] = [];
  const set = (key: string, value: string | null) => rows.push({ key, value });

  if (input.dashboardName !== undefined) set(SETTING_KEYS.dashboardName, input.dashboardName);
  if (input.theme !== undefined) set(SETTING_KEYS.theme, input.theme);
  if (input.accent !== undefined) set(SETTING_KEYS.accent, input.accent);
  if (input.timezone !== undefined) set(SETTING_KEYS.timezone, input.timezone);
  if (input.logoPath !== undefined) set(SETTING_KEYS.logoPath, input.logoPath);
  if (input.authEnabled !== undefined) set(SETTING_KEYS.authEnabled, String(input.authEnabled));
  if (input.appHealthIntervalMs !== undefined)
    set(SETTING_KEYS.appHealthIntervalMs, String(input.appHealthIntervalMs));
  if (input.systemMetricIntervalMs !== undefined)
    set(SETTING_KEYS.systemMetricIntervalMs, String(input.systemMetricIntervalMs));
  if (input.metricRetentionDays !== undefined)
    set(SETTING_KEYS.metricRetentionDays, String(input.metricRetentionDays));
  if (input.thresholds !== undefined) {
    set(SETTING_KEYS.thresholdCpu, String(input.thresholds.cpuPercent));
    set(SETTING_KEYS.thresholdMemory, String(input.thresholds.memoryPercent));
    set(SETTING_KEYS.thresholdStorage, String(input.thresholds.storagePercent));
  }
  return rows;
}
