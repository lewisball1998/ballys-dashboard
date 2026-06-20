import type { AppDTO, CategoryDTO, HealthStatus } from "@/lib/types";
import { appCreateSchema, type AppCreateInput } from "@/lib/validation";
import type { BadgeTone } from "@/components/ui/badge";

/** Pure launcher logic (no React) so it is unit-testable in a node environment. */

// --- health badge mapping ---------------------------------------------------

export function healthTone(status: HealthStatus | null | undefined): BadgeTone {
  switch (status) {
    case "up":
      return "success";
    case "degraded":
      return "warning";
    case "down":
      return "error";
    default:
      return "neutral";
  }
}

export function healthLabel(status: HealthStatus | null | undefined): string {
  switch (status) {
    case "up":
      return "Up";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    default:
      return "Unknown";
  }
}

export interface HealthSummary {
  total: number;
  monitored: number;
  up: number;
  degraded: number;
  down: number;
  unknown: number;
}

/** Summarise health across apps (only health-enabled apps are "monitored"). */
export function summariseAppHealth(apps: AppDTO[]): HealthSummary {
  const summary: HealthSummary = { total: apps.length, monitored: 0, up: 0, degraded: 0, down: 0, unknown: 0 };
  for (const app of apps) {
    if (!app.healthEnabled) continue;
    summary.monitored += 1;
    switch (app.latestHealth?.status) {
      case "up":
        summary.up += 1;
        break;
      case "degraded":
        summary.degraded += 1;
        break;
      case "down":
        summary.down += 1;
        break;
      default:
        summary.unknown += 1;
    }
  }
  return summary;
}

// --- grouping ---------------------------------------------------------------

export interface AppGroup {
  category: CategoryDTO | null; // null = uncategorised
  apps: AppDTO[];
}

function sortApps(list: AppDTO[]): AppDTO[] {
  return [...list].sort(
    (a, b) =>
      Number(b.isFavourite) - Number(a.isFavourite) || // favourites pinned first
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );
}

/**
 * Group apps under their categories (in category order). Empty categories are
 * kept (so management actions are reachable); the uncategorised section is only
 * included when it has apps.
 */
export function groupAppsByCategory(apps: AppDTO[], categories: CategoryDTO[]): AppGroup[] {
  const orderedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const groups: AppGroup[] = orderedCats.map((category) => ({
    category,
    apps: sortApps(apps.filter((a) => a.categoryId === category.id)),
  }));

  const uncategorised = sortApps(apps.filter((a) => a.categoryId == null));
  if (uncategorised.length > 0) groups.push({ category: null, apps: uncategorised });
  return groups;
}

// --- app form ---------------------------------------------------------------

export interface AppFormValues {
  name: string;
  url: string;
  description: string;
  categoryId: number | null;
  icon: string;
  openNewTab: boolean;
  isFavourite: boolean;
  healthEnabled: boolean;
  healthUrl: string;
}

export function emptyAppForm(categoryId: number | null = null): AppFormValues {
  return {
    name: "",
    url: "",
    description: "",
    categoryId,
    icon: "",
    openNewTab: true,
    isFavourite: false,
    healthEnabled: false,
    healthUrl: "",
  };
}

export function appToForm(app: AppDTO): AppFormValues {
  return {
    name: app.name,
    url: app.url,
    description: app.description ?? "",
    categoryId: app.categoryId,
    icon: app.icon ?? "",
    openNewTab: app.openNewTab,
    isFavourite: app.isFavourite,
    healthEnabled: app.healthEnabled,
    healthUrl: app.healthUrl ?? "",
  };
}

const orNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

/** Map form values to a create/update payload (empty optional strings → null). */
export function buildAppPayload(v: AppFormValues): AppCreateInput {
  return {
    name: v.name.trim(),
    url: v.url.trim(),
    categoryId: v.categoryId,
    description: orNull(v.description),
    icon: orNull(v.icon),
    openNewTab: v.openNewTab,
    isFavourite: v.isFavourite,
    healthEnabled: v.healthEnabled,
    healthUrl: orNull(v.healthUrl),
  };
}

export type AppFieldErrors = Partial<Record<keyof AppFormValues | "form", string[]>>;

export type AppValidateResult =
  | { success: true; data: AppCreateInput }
  | { success: false; fieldErrors: AppFieldErrors };

export function validateAppForm(v: AppFormValues): AppValidateResult {
  const result = appCreateSchema.safeParse(buildAppPayload(v));
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: AppFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form") as keyof AppFieldErrors;
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { success: false, fieldErrors };
}

/** Map a server ApiError.fields onto the form fields. */
export function apiFieldErrors(fields: Record<string, string[]> | undefined): AppFieldErrors {
  const out: AppFieldErrors = {};
  for (const [key, messages] of Object.entries(fields ?? {})) {
    out[key as keyof AppFieldErrors] = messages;
  }
  return out;
}
