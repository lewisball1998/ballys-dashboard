/**
 * Category DTOs. ⭐ ARCHITECT-OWNED. Mirrors the `categories` table, with
 * timestamps as ISO strings.
 */
export interface CategoryDTO {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
