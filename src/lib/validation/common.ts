import { z } from "zod";

/**
 * Shared zod primitives. ⭐ ARCHITECT-OWNED. Resource schemas import from here
 * (never from ./index) to avoid circular imports through the barrel.
 */

/** A user-supplied http(s) URL accepted by the launcher / health checks. */
export const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: "Only http(s) URLs are allowed" });

export const severitySchema = z.enum(["info", "success", "warning", "error"]);
export const healthStatusSchema = z.enum(["up", "down", "degraded", "unknown"]);

/** Pagination params shared by list endpoints. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;

/** `:id` route params (strings from the URL coerced to a positive int). */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type IdParam = z.infer<typeof idParamSchema>;
