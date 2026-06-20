import type { AccentColor, ApiError, SetupSeedResultDTO, SetupStatusDTO, ThemeMode } from "@/lib/types";
import { settingsUpdateSchema, type SetupCompleteInput, type SettingsUpdateInput } from "@/lib/validation";

/** Pure setup-wizard logic (no React) so it is unit-testable in node. */

export interface AppearanceValues {
  dashboardName: string;
  theme: ThemeMode;
  accent: AccentColor;
  timezone: string;
  logoPath: string;
}

export type AppearanceErrors = Partial<Record<keyof AppearanceValues | "form", string[]>>;

export function statusToAppearance(status: SetupStatusDTO): AppearanceValues {
  return {
    dashboardName: status.dashboardName,
    theme: status.theme,
    accent: status.accent,
    timezone: status.timezone,
    logoPath: status.logoPath ?? "",
  };
}

/** Map appearance form values to the settings update payload. */
export function appearanceToSettings(a: AppearanceValues): SettingsUpdateInput {
  return {
    dashboardName: a.dashboardName.trim(),
    theme: a.theme,
    accent: a.accent,
    timezone: a.timezone.trim(),
    logoPath: a.logoPath.trim() === "" ? null : a.logoPath.trim(),
  };
}

export function buildCompletePayload(a: AppearanceValues): SetupCompleteInput {
  return { settings: appearanceToSettings(a) };
}

export type ValidateResult =
  | { success: true; data: SettingsUpdateInput }
  | { success: false; fieldErrors: AppearanceErrors };

export function validateAppearance(a: AppearanceValues): ValidateResult {
  const result = settingsUpdateSchema.safeParse(appearanceToSettings(a));
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: AppearanceErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form") as keyof AppearanceErrors;
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { success: false, fieldErrors };
}

export function apiErrorToAppearanceErrors(error: ApiError): AppearanceErrors {
  return (error.fields ?? {}) as AppearanceErrors;
}

/** Human summary of a seed result. */
export function formatSeedResult(result: SetupSeedResultDTO): string {
  if (result.categoriesCreated === 0 && result.categoriesSkipped === 0) {
    return "No categories to create.";
  }
  const parts: string[] = [];
  if (result.categoriesCreated > 0) {
    parts.push(`Created ${result.categoriesCreated} categor${result.categoriesCreated === 1 ? "y" : "ies"}`);
  }
  if (result.categoriesSkipped > 0) {
    parts.push(`skipped ${result.categoriesSkipped} existing`);
  }
  return `${parts.join(", ")}.`;
}

/** Gate decision: does the dashboard need to prompt for setup? */
export function needsSetup(status: SetupStatusDTO): boolean {
  return !status.setupCompleted;
}
