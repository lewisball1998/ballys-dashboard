import { z } from "zod";

/** Category request schemas. ⭐ ARCHITECT-OWNED. */

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(256).nullish(),
  sortOrder: z.number().int().min(0).optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

/** POST /api/categories/reorder — ordered list of category ids. */
export const categoryReorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryReorderInput = z.infer<typeof categoryReorderSchema>;
