/**
 * Settings DTOs. ⭐ ARCHITECT-OWNED.
 *
 * The DB stores settings as a key/value table, but the API exposes them as a
 * single structured object so the UI and services get a typed surface. Backend
 * maps the kv rows (SETTING_KEYS in lib/constants) to/from this shape.
 */

/** Literal sources of truth — reused by the zod schemas (lib/validation). */
export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** v0.1 accent palette (Q9). Full theming is a later milestone. */
export const ACCENT_COLORS = ["blue", "emerald", "violet", "amber", "rose", "slate"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export interface ThresholdSettings {
  /** Percentages (1–100) above which a notification is raised (Q6). */
  cpuPercent: number;
  memoryPercent: number;
  storagePercent: number;
}

export interface AppSettingsDTO {
  dashboardName: string;
  theme: ThemeMode;
  accent: AccentColor;
  /** IANA timezone, e.g. "Europe/London". */
  timezone: string;
  logoPath: string | null;
  /** Optional single-user auth toggle (Q1). */
  authEnabled: boolean;
  /** Set by the setup wizard; not editable via the general settings PATCH. */
  setupCompleted: boolean;
  appHealthIntervalMs: number;
  systemMetricIntervalMs: number;
  metricRetentionDays: number;
  thresholds: ThresholdSettings;
}
