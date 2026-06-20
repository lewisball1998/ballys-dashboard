import { describe, it, expect } from "vitest";
import { rowsToSettings, settingsUpdateToRows } from "@/server/services/settings-mapping";
import { DEFAULTS, SETTING_KEYS } from "@/lib/constants";

describe("settings mapping", () => {
  it("returns defaults for an empty kv store", () => {
    const s = rowsToSettings([]);
    expect(s.dashboardName).toBe(DEFAULTS.appearance.dashboardName);
    expect(s.theme).toBe(DEFAULTS.appearance.theme);
    expect(s.accent).toBe(DEFAULTS.appearance.accent);
    expect(s.authEnabled).toBe(DEFAULTS.authEnabledByDefault);
    expect(s.setupCompleted).toBe(false);
    expect(s.logoPath).toBeNull();
    expect(s.appHealthIntervalMs).toBe(DEFAULTS.appHealthIntervalMs);
    expect(s.systemMetricIntervalMs).toBe(DEFAULTS.systemMetricIntervalMs);
    expect(s.metricRetentionDays).toBe(DEFAULTS.metricRetentionDays);
    expect(s.thresholds.cpuPercent).toBe(DEFAULTS.thresholds.cpuPercent);
  });

  it("overrides defaults from rows with correct types", () => {
    const s = rowsToSettings([
      { key: SETTING_KEYS.dashboardName, value: "Home Lab" },
      { key: SETTING_KEYS.theme, value: "dark" },
      { key: SETTING_KEYS.authEnabled, value: "false" },
      { key: SETTING_KEYS.setupCompleted, value: "true" },
      { key: SETTING_KEYS.systemMetricIntervalMs, value: "5000" },
      { key: SETTING_KEYS.thresholdCpu, value: "75" },
      { key: SETTING_KEYS.logoPath, value: "/uploads/logo.png" },
    ]);
    expect(s.dashboardName).toBe("Home Lab");
    expect(s.theme).toBe("dark");
    expect(s.authEnabled).toBe(false);
    expect(s.setupCompleted).toBe(true);
    expect(s.systemMetricIntervalMs).toBe(5000);
    expect(s.thresholds.cpuPercent).toBe(75);
    expect(s.logoPath).toBe("/uploads/logo.png");
  });

  it("falls back to default for an unparseable numeric value", () => {
    const s = rowsToSettings([{ key: SETTING_KEYS.metricRetentionDays, value: "not-a-number" }]);
    expect(s.metricRetentionDays).toBe(DEFAULTS.metricRetentionDays);
  });
});

describe("settingsUpdateToRows", () => {
  it("maps only provided fields, with thresholds expanded to three keys", () => {
    const rows = settingsUpdateToRows({
      dashboardName: "X",
      authEnabled: true,
      systemMetricIntervalMs: 9000,
      logoPath: null,
      thresholds: { cpuPercent: 80, memoryPercent: 85, storagePercent: 90 },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    expect(map.get(SETTING_KEYS.dashboardName)).toBe("X");
    expect(map.get(SETTING_KEYS.authEnabled)).toBe("true");
    expect(map.get(SETTING_KEYS.systemMetricIntervalMs)).toBe("9000");
    expect(map.get(SETTING_KEYS.logoPath)).toBeNull();
    expect(map.get(SETTING_KEYS.thresholdCpu)).toBe("80");
    expect(map.get(SETTING_KEYS.thresholdMemory)).toBe("85");
    expect(map.get(SETTING_KEYS.thresholdStorage)).toBe("90");
    // not provided -> not present
    expect(map.has(SETTING_KEYS.theme)).toBe(false);
  });

  it("produces no rows for an empty update", () => {
    expect(settingsUpdateToRows({})).toHaveLength(0);
  });
});
