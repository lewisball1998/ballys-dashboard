/**
 * Custom (user-uploaded) icon DTOs. ⭐ ARCHITECT-OWNED. Mirrors the
 * `custom_icons` table. The raw bytes are served separately by opaque id at
 * `/api/icons/:id/raw` — a filesystem path is never exposed.
 */
export interface CustomIconDTO {
  id: string;
  mime: string;
  /** Stored file size in bytes. */
  bytes: number;
  createdAt: string;
}

/**
 * An icon within an imported pack (v0.2.8). Selected as `pack:<packId>/<key>`;
 * bytes are served by `(packId, key)` at `/api/icons/packs/:packId/:key/raw`.
 */
export interface IconPackIconDTO {
  key: string;
  label: string | null;
  /** Declared non-base variant slugs available for this icon (may be empty). */
  variants: string[];
}

/** An imported icon pack and its icons (v0.2.8). Mirrors `icon_packs` + children. */
export interface IconPackDTO {
  id: string;
  name: string;
  version: string;
  author: string | null;
  license: string | null;
  /** Display/link only — never fetched by the server. */
  homepage: string | null;
  iconCount: number;
  /** Total bytes stored on disk for this pack. */
  bytes: number;
  createdAt: string;
  icons: IconPackIconDTO[];
}

/**
 * Per-app outcome of a bulk pack-icon match apply (v0.2.9):
 *   - `applied` — `apps.icon` was set to the pack ref.
 *   - `skipped` — intentionally unchanged (already set, protected custom icon
 *     without opt-in, unknown icon key, or app not found).
 *   - `failed`  — an unexpected error while updating the app.
 */
export type PackMatchOutcomeStatus = "applied" | "skipped" | "failed";

export interface PackMatchOutcomeDTO {
  appId: number;
  name: string;
  status: PackMatchOutcomeStatus;
  /** The resulting icon reference when `status === "applied"`. */
  icon: string | null;
  /** Reason for a skip/failure, when applicable. */
  message: string | null;
}

/** Summary of a bulk apply (v0.2.9). Mirrors the Docker import result shape. */
export interface PackMatchApplyResultDTO {
  applied: number;
  skipped: number;
  failed: number;
  outcomes: PackMatchOutcomeDTO[];
}
