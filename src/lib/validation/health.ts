import { z } from "zod";

/**
 * App health query schema. ⭐ ARCHITECT-OWNED. Health results are
 * server-generated, so there are no create/update schemas — only this query for
 * GET /api/apps/:id/health (history + computed uptime window).
 */
export const healthHistoryQuerySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(720).default(24),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type HealthHistoryQuery = z.infer<typeof healthHistoryQuerySchema>;
