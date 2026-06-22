import { describe, it, expect } from "vitest";
import {
  capacitySeverity,
  isAlertable,
  temperatureSeverity,
  worstSeverity,
} from "@/server/telemetry/severity";

describe("temperatureSeverity", () => {
  it("applies the v0.3.0 thresholds (45 warn / 55 critical)", () => {
    expect(temperatureSeverity(44)).toBe("healthy");
    expect(temperatureSeverity(45)).toBe("warning");
    expect(temperatureSeverity(54)).toBe("warning");
    expect(temperatureSeverity(55)).toBe("critical");
  });

  it("treats unknown as unavailable, never critical", () => {
    expect(temperatureSeverity(null)).toBe("unavailable");
    expect(temperatureSeverity(undefined)).toBe("unavailable");
    expect(temperatureSeverity(Number.NaN)).toBe("unavailable");
  });
});

describe("capacitySeverity", () => {
  it("uses default 80/90 bands", () => {
    expect(capacitySeverity(79)).toBe("healthy");
    expect(capacitySeverity(80)).toBe("warning");
    expect(capacitySeverity(89)).toBe("warning");
    expect(capacitySeverity(90)).toBe("critical");
  });

  it("honours custom thresholds and keeps critical above warning", () => {
    expect(capacitySeverity(85, 70, 95)).toBe("warning");
    expect(capacitySeverity(96, 70, 95)).toBe("critical");
    // degenerate input: warning >= critical must not misclassify
    expect(capacitySeverity(85, 95, 90)).toBe("healthy");
    expect(capacitySeverity(96, 95, 90)).toBe("critical");
  });

  it("treats unknown as unavailable", () => {
    expect(capacitySeverity(null)).toBe("unavailable");
    expect(capacitySeverity(Number.NaN)).toBe("unavailable");
  });
});

describe("worstSeverity", () => {
  it("ignores unavailable when real signal exists", () => {
    expect(worstSeverity(["healthy", "unavailable"])).toBe("healthy");
    expect(worstSeverity(["warning", "critical"])).toBe("critical");
    expect(worstSeverity(["healthy", "warning"])).toBe("warning");
  });

  it("falls back to unavailable only when nothing is known", () => {
    expect(worstSeverity([])).toBe("unavailable");
    expect(worstSeverity(["unavailable", "unavailable"])).toBe("unavailable");
  });
});

describe("isAlertable", () => {
  it("only warning and critical alert", () => {
    expect(isAlertable("warning")).toBe(true);
    expect(isAlertable("critical")).toBe(true);
    expect(isAlertable("healthy")).toBe(false);
    expect(isAlertable("unavailable")).toBe(false);
  });
});
