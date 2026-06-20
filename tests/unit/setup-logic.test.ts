import { describe, expect, it } from "vitest";
import type { SetupStatusDTO } from "@/lib/types";
import {
  appearanceToSettings,
  buildCompletePayload,
  formatSeedResult,
  needsSetup,
  statusToAppearance,
  validateAppearance,
  type AppearanceValues,
} from "@/components/setup/setup-logic";

const status: SetupStatusDTO = {
  setupCompleted: false,
  dashboardName: "Bally's Dashboard",
  theme: "system",
  accent: "blue",
  timezone: "UTC",
  logoPath: null,
  appCount: 0,
  categoryCount: 0,
  templates: [],
};

const appearance: AppearanceValues = {
  dashboardName: "Home",
  theme: "dark",
  accent: "emerald",
  timezone: "Europe/London",
  logoPath: "",
};

describe("setup appearance mapping", () => {
  it("maps status to appearance (null logo -> empty string)", () => {
    expect(statusToAppearance(status)).toMatchObject({ dashboardName: "Bally's Dashboard", logoPath: "" });
  });

  it("trims and nulls empty optional fields in the settings payload", () => {
    const settings = appearanceToSettings({ ...appearance, dashboardName: "  Home  ", logoPath: "  " });
    expect(settings.dashboardName).toBe("Home");
    expect(settings.logoPath).toBeNull();
  });

  it("buildCompletePayload nests settings", () => {
    expect(buildCompletePayload(appearance)).toEqual({ settings: appearanceToSettings(appearance) });
  });
});

describe("validateAppearance", () => {
  it("accepts valid appearance", () => {
    expect(validateAppearance(appearance).success).toBe(true);
  });
  it("flags an empty dashboard name", () => {
    const r = validateAppearance({ ...appearance, dashboardName: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.dashboardName?.length).toBeGreaterThan(0);
  });
  it("flags an empty timezone", () => {
    const r = validateAppearance({ ...appearance, timezone: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.timezone?.length).toBeGreaterThan(0);
  });
});

describe("formatSeedResult", () => {
  it("formats created/skipped variants", () => {
    expect(formatSeedResult({ template: "homelab", categoriesCreated: 5, categoriesSkipped: 0 })).toBe(
      "Created 5 categories.",
    );
    expect(formatSeedResult({ template: "homelab", categoriesCreated: 4, categoriesSkipped: 1 })).toBe(
      "Created 4 categories, skipped 1 existing.",
    );
    expect(formatSeedResult({ template: "homelab", categoriesCreated: 1, categoriesSkipped: 0 })).toBe(
      "Created 1 category.",
    );
    expect(formatSeedResult({ template: "homelab", categoriesCreated: 0, categoriesSkipped: 5 })).toBe(
      "skipped 5 existing.",
    );
    expect(formatSeedResult({ template: "blank", categoriesCreated: 0, categoriesSkipped: 0 })).toBe(
      "No categories to create.",
    );
  });
});

describe("needsSetup gate", () => {
  it("is true when not completed, false when completed", () => {
    expect(needsSetup(status)).toBe(true);
    expect(needsSetup({ ...status, setupCompleted: true })).toBe(false);
  });
});
