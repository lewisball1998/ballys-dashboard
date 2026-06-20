import { protectedRoute, jsonOk, parseQuery } from "@/server/api/respond";
import { metricsQuerySchema } from "@/lib/validation";
import type { MetricsResponseDTO } from "@/lib/types";
import { getLatestMetrics, getMetricsWindow } from "@/server/services/metrics";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async (req) => {
  const parsed = parseQuery(req.nextUrl.searchParams, metricsQuerySchema);
  if (!parsed.success) return parsed.response;

  const { window, sourceId, limit } = parsed.data;
  const points =
    window !== undefined ? getMetricsWindow(window, sourceId, limit) : getLatestMetrics();

  const body: MetricsResponseDTO = { points };
  return jsonOk(body);
});
