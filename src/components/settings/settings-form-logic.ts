import type { ZodError } from "zod";
import { settingsUpdateSchema, type SettingsUpdateInput } from "@/lib/validation";
import type { AppSettingsDTO, ApiError, ThemeMode, AccentColor } from "@/lib/types";

/**
 * Pure form logic for the settings page (no React) so it can be unit-tested:
 * mapping settings <-> form values, building the PATCH payload, and turning both
 * client (zod) and server (ApiError) validation failures into per-field errors.
 */
export interface SettingsFormValues {
  dashboardName: string;
  theme: ThemeMode;
  accent: AccentColor;
  timezone: string;
  appHealthIntervalMs: number;
  systemMetricIntervalMs: number;
  metricRetentionDays: number;
  thresholdCpu: number;
  thresholdMemory: number;
  thresholdStorage: number;
}

export type FieldErrors = Partial<Record<keyof SettingsFormValues | "form", string[]>>;

export function settingsToForm(s: AppSettingsDTO): SettingsFormValues {
  return {
    dashboardName: s.dashboardName,
    theme: s.theme,
    accent: s.accent,
    timezone: s.timezone,
    appHealthIntervalMs: s.appHealthIntervalMs,
    systemMetricIntervalMs: s.systemMetricIntervalMs,
    metricRetentionDays: s.metricRetentionDays,
    thresholdCpu: s.thresholds.cpuPercent,
    thresholdMemory: s.thresholds.memoryPercent,
    thresholdStorage: s.thresholds.storagePercent,
  };
}

export function formToPatch(v: SettingsFormValues): SettingsUpdateInput {
  return {
    dashboardName: v.dashboardName,
    theme: v.theme,
    accent: v.accent,
    timezone: v.timezone,
    appHealthIntervalMs: v.appHealthIntervalMs,
    systemMetricIntervalMs: v.systemMetricIntervalMs,
    metricRetentionDays: v.metricRetentionDays,
    thresholds: {
      cpuPercent: v.thresholdCpu,
      memoryPercent: v.thresholdMemory,
      storagePercent: v.thresholdStorage,
    },
  };
}

function pathToField(path: (string | number)[]): keyof SettingsFormValues | "form" {
  if (path[0] === "thresholds") {
    const key = String(path[1] ?? "");
    if (key === "cpuPercent") return "thresholdCpu";
    if (key === "memoryPercent") return "thresholdMemory";
    if (key === "storagePercent") return "thresholdStorage";
  }
  const head = String(path[0] ?? "form");
  return (head in EMPTY_FORM ? head : "form") as keyof SettingsFormValues | "form";
}

const EMPTY_FORM: Record<keyof SettingsFormValues, true> = {
  dashboardName: true,
  theme: true,
  accent: true,
  timezone: true,
  appHealthIntervalMs: true,
  systemMetricIntervalMs: true,
  metricRetentionDays: true,
  thresholdCpu: true,
  thresholdMemory: true,
  thresholdStorage: true,
};

function zodToFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = pathToField(issue.path);
    (out[field] ??= []).push(issue.message);
  }
  return out;
}

export type ValidateResult =
  | { success: true; data: SettingsUpdateInput }
  | { success: false; fieldErrors: FieldErrors };

export function validateForm(values: SettingsFormValues): ValidateResult {
  const result = settingsUpdateSchema.safeParse(formToPatch(values));
  if (result.success) return { success: true, data: result.data };
  return { success: false, fieldErrors: zodToFieldErrors(result.error) };
}

/** Map a server ApiError's `fields` onto form fields (thresholds → 3 inputs). */
export function apiErrorToFieldErrors(error: ApiError): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(error.fields ?? {})) {
    if (key === "thresholds") {
      out.thresholdCpu = messages;
      out.thresholdMemory = messages;
      out.thresholdStorage = messages;
    } else if (key in EMPTY_FORM) {
      out[key as keyof SettingsFormValues] = messages;
    } else {
      (out.form ??= []).push(...messages);
    }
  }
  return out;
}
