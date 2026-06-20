import { z } from "zod";

/**
 * Shared zod schemas used by API route handlers (server) and forms (client).
 *
 * OWNED BY: Product Architect. ⭐ contract file. Phase 0 ships only the schemas
 * needed to prove the pattern; Phase 1+ adds apps/categories/settings schemas.
 */

/** A user-supplied URL accepted by the launcher / health checks. */
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
