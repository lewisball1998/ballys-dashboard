/**
 * Default product settings. These are seeded into the `settings` table and are
 * all editable from the UI (Settings page, v0.1). Nothing here is a hard-coded
 * assumption about a user's environment.
 */
export const DEFAULTS = {
  /** App health check cadence (Q11 answer: 30s). */
  appHealthIntervalMs: 30_000,
  /** Local system metric cadence (Q11 answer: 15s). */
  systemMetricIntervalMs: 15_000,
  /** How long to keep metric rows before the retention job trims them (Q11: 7d). */
  metricRetentionDays: 7,
  /** Threshold breaches that raise notifications (Q6). User-configurable. */
  thresholds: {
    cpuPercent: 90,
    memoryPercent: 90,
    storagePercent: 90,
  },
  /** Appearance defaults (Q9: light/dark + accent). */
  appearance: {
    theme: "system" as "light" | "dark" | "system",
    accent: "blue",
    dashboardName: "Bally's Dashboard",
    timezone: "UTC",
  },
  /** Auth is optional and on by default; skippable in setup (Q1). */
  authEnabledByDefault: true,
} as const;

export const APP_VERSION = "0.1.0";

/** Setting keys used across the app (single source of truth for the kv store). */
export const SETTING_KEYS = {
  setupCompleted: "setup_completed",
  dashboardName: "dashboard_name",
  theme: "theme",
  accent: "accent",
  timezone: "timezone",
  logoPath: "logo_path",
  authEnabled: "auth_enabled",
  appHealthIntervalMs: "app_health_interval_ms",
  systemMetricIntervalMs: "system_metric_interval_ms",
  metricRetentionDays: "metric_retention_days",
  thresholdCpu: "threshold_cpu_percent",
  thresholdMemory: "threshold_memory_percent",
  thresholdStorage: "threshold_storage_percent",
} as const;
