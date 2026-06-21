import { z } from "zod";

/** Custom icon request schemas. ⭐ ARCHITECT-OWNED. */

/** `:id` route param for custom icons — opaque hex token (not a numeric id). */
export const customIconIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{8,64}$/i, "Invalid icon id"),
});

export type CustomIconIdParam = z.infer<typeof customIconIdParamSchema>;
