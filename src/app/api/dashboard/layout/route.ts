import { protectedRoute, jsonOk, parseJson } from "@/server/api/respond";
import { dashboardLayoutConfigSchema } from "@/lib/validation";
import { getResolvedLayout, saveLayout } from "@/server/services/dashboard-layout";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  return jsonOk(getResolvedLayout());
});

export const PUT = protectedRoute(async (req) => {
  const parsed = await parseJson(req, dashboardLayoutConfigSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(saveLayout(parsed.data));
});
