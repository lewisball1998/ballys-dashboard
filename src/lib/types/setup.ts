/**
 * Setup wizard DTOs. ⭐ ARCHITECT-OWNED (additive — the API contract listed the
 * setup routes as a placeholder; these finalise the shapes). Pending Architect
 * ratification.
 */
import type { AccentColor, ThemeMode } from "./settings";

export interface SetupTemplateSummary {
  id: string;
  name: string;
  description: string;
  /** Generic category names this template seeds. */
  categories: string[];
}

export interface SetupStatusDTO {
  setupCompleted: boolean;
  dashboardName: string;
  theme: ThemeMode;
  accent: AccentColor;
  timezone: string;
  logoPath: string | null;
  appCount: number;
  categoryCount: number;
  templates: SetupTemplateSummary[];
}

export interface SetupSeedResultDTO {
  template: string;
  categoriesCreated: number;
  categoriesSkipped: number;
}
