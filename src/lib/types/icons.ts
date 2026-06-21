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
