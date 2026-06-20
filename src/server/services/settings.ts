import { db } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULTS, SETTING_KEYS } from "@/lib/constants";
import type { AppSettingsDTO } from "@/lib/types";
import type { SettingsUpdateInput } from "@/lib/validation";
import { rowsToSettings, settingsUpdateToRows } from "./settings-mapping";

export { rowsToSettings, settingsUpdateToRows };

/** Read the structured settings DTO from the kv store. */
export function getSettings(): AppSettingsDTO {
  const rows = db.select({ key: settings.key, value: settings.value }).from(settings).all();
  return rowsToSettings(rows);
}

/** Insert default settings for any keys that don't exist yet. Idempotent. */
export function seedSettings(): void {
  const now = new Date();
  const defaults: { key: string; value: string }[] = [
    { key: SETTING_KEYS.setupCompleted, value: "false" },
    { key: SETTING_KEYS.dashboardName, value: DEFAULTS.appearance.dashboardName },
    { key: SETTING_KEYS.theme, value: DEFAULTS.appearance.theme },
    { key: SETTING_KEYS.accent, value: DEFAULTS.appearance.accent },
    { key: SETTING_KEYS.timezone, value: DEFAULTS.appearance.timezone },
    { key: SETTING_KEYS.authEnabled, value: String(DEFAULTS.authEnabledByDefault) },
    { key: SETTING_KEYS.appHealthIntervalMs, value: String(DEFAULTS.appHealthIntervalMs) },
    { key: SETTING_KEYS.systemMetricIntervalMs, value: String(DEFAULTS.systemMetricIntervalMs) },
    { key: SETTING_KEYS.metricRetentionDays, value: String(DEFAULTS.metricRetentionDays) },
    { key: SETTING_KEYS.thresholdCpu, value: String(DEFAULTS.thresholds.cpuPercent) },
    { key: SETTING_KEYS.thresholdMemory, value: String(DEFAULTS.thresholds.memoryPercent) },
    { key: SETTING_KEYS.thresholdStorage, value: String(DEFAULTS.thresholds.storagePercent) },
  ];
  db.insert(settings)
    .values(defaults.map((d) => ({ ...d, updatedAt: now })))
    .onConflictDoNothing()
    .run();
}

/** Apply a validated partial update and return the new settings. */
export function updateSettings(input: SettingsUpdateInput): AppSettingsDTO {
  const rows = settingsUpdateToRows(input);
  if (rows.length > 0) {
    const now = new Date();
    db.transaction((tx) => {
      for (const r of rows) {
        tx.insert(settings)
          .values({ key: r.key, value: r.value, updatedAt: now })
          .onConflictDoUpdate({ target: settings.key, set: { value: r.value, updatedAt: now } })
          .run();
      }
    });
  }
  return getSettings();
}
