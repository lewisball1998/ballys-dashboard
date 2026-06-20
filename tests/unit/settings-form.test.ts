import { describe, expect, it } from "vitest";
import type { AppSettingsDTO } from "@/lib/types";
import {
  apiErrorToFieldErrors,
  formToPatch,
  settingsToForm,
  validateForm,
} from "@/components/settings/settings-form-logic";

const base: AppSettingsDTO = {
  dashboardName: "Lab",
  theme: "system",
  accent: "blue",
  timezone: "UTC",
  logoPath: null,
  authEnabled: true,
  setupCompleted: false,
  appHealthIntervalMs: 30_000,
  systemMetricIntervalMs: 15_000,
  metricRetentionDays: 7,
  thresholds: { cpuPercent: 90, memoryPercent: 90, storagePercent: 90 },
};

describe("settings form logic", () => {
  it("round-trips settings <-> form values", () => {
    const form = settingsToForm(base);
    expect(form.dashboardName).toBe("Lab");
    expect(form.thresholdCpu).toBe(90);
    const patch = formToPatch(form);
    expect(patch.theme).toBe("system");
    expect(patch.thresholds?.cpuPercent).toBe(90);
  });

  it("accepts a valid form", () => {
    expect(validateForm(settingsToForm(base)).success).toBe(true);
  });

  it("reports an out-of-range threshold on the right field", () => {
    const result = validateForm({ ...settingsToForm(base), thresholdCpu: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.thresholdCpu?.length).toBeGreaterThan(0);
  });

  it("reports an empty dashboard name", () => {
    const result = validateForm({ ...settingsToForm(base), dashboardName: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.dashboardName?.length).toBeGreaterThan(0);
  });

  it("maps a server 'thresholds' error onto the three threshold fields", () => {
    const fe = apiErrorToFieldErrors({
      code: "validation_error",
      message: "x",
      fields: { thresholds: ["bad"] },
    });
    expect(fe.thresholdCpu).toEqual(["bad"]);
    expect(fe.thresholdMemory).toEqual(["bad"]);
    expect(fe.thresholdStorage).toEqual(["bad"]);
  });
});
