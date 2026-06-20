import { protectedRoute, jsonOk, jsonError, parseBody, parseQuery } from "@/server/api/respond";
import { healthHistoryQuerySchema, idParamSchema } from "@/lib/validation";
import type { AppHealthResultDTO, AppHealthStatsDTO } from "@/lib/types";
import { getApp } from "@/server/services/apps";
import { getHistory, getStats } from "@/server/services/app-health";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const queryRes = parseQuery(req.nextUrl.searchParams, healthHistoryQuerySchema);
  if (!queryRes.success) return queryRes.response;

  const id = idRes.data.id;
  if (!getApp(id)) return jsonError("not_found", "App not found", 404);

  const { windowHours, limit } = queryRes.data;
  const body: { stats: AppHealthStatsDTO; history: AppHealthResultDTO[] } = {
    stats: getStats(id, windowHours),
    history: getHistory(id, windowHours, limit),
  };
  return jsonOk(body);
});
