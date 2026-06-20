import type { DockerImportCandidateDTO } from "@/lib/types";
import type { DockerImportItemInput } from "@/lib/validation";
import {
  buildAppPayload,
  validateAppForm,
  type AppFieldErrors,
  type AppFormValues,
} from "@/components/launcher/launcher-logic";

/**
 * Pure logic for the Import-from-Docker flow (no React) so it is unit-testable.
 * Reuses the launcher form values + validation so imported apps go through the
 * exact same rules as a hand-added app (required http(s) URL, health/TLS fields).
 */

/** One editable row: a candidate, whether it is selected, and its draft values. */
export interface ImportRow {
  selected: boolean;
  values: AppFormValues;
}

/** Seed a row's editable values from the server's suggestions. Nothing is
 * selected by default — the user must opt each candidate in. */
export function candidateToRow(candidate: DockerImportCandidateDTO): ImportRow {
  return {
    selected: false,
    values: {
      name: candidate.suggestedName,
      url: candidate.suggestedUrl ?? "",
      description: "",
      categoryId: null,
      icon: "",
      openNewTab: true,
      isFavourite: false,
      healthEnabled: false,
      healthUrl: "",
      healthInsecureTls: false,
    },
  };
}

/** Build the rows map keyed by container id. */
export function buildRows(candidates: DockerImportCandidateDTO[]): Record<string, ImportRow> {
  const rows: Record<string, ImportRow> = {};
  for (const c of candidates) rows[c.containerId] = candidateToRow(c);
  return rows;
}

/** Map a row's values + container id to the import request item. */
export function buildImportItem(containerId: string, values: AppFormValues): DockerImportItemInput {
  return { ...buildAppPayload(values), containerId };
}

export type RowValidation =
  | { success: true; item: DockerImportItemInput }
  | { success: false; fieldErrors: AppFieldErrors };

/** Validate one selected row (same schema as the app form). */
export function validateRow(containerId: string, values: AppFormValues): RowValidation {
  const result = validateAppForm(values);
  if (result.success) return { success: true, item: { ...result.data, containerId } };
  return { success: false, fieldErrors: result.fieldErrors };
}

export function selectedIds(rows: Record<string, ImportRow>): string[] {
  return Object.entries(rows)
    .filter(([, row]) => row.selected)
    .map(([id]) => id);
}
