import { z } from "zod";

/**
 * Metrics query schema. ⭐ ARCHITECT-OWNED (additive, see types/metrics.ts).
 *
 * GET /api/metrics:
 *   - no `window`  -> latest value per (sourceId, metric)
 *   - with `window` (minutes) -> all points in that window, optionally filtered
 *     by `sourceId`.
 */
export const metricsQuerySchema = z.object({
  window: z.coerce.number().int().min(1).max(10080).optional(),
  sourceId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(2000),
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
