import { protectedRoute, jsonOk, jsonError, parseBody } from "@/server/api/respond";
import { idParamSchema } from "@/lib/validation";
import { checkAppById } from "@/server/services/app-health";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** On-demand health check (manual). Runs via the guarded fetch wrapper. */
export const POST = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;

  const result = await checkAppById(idRes.data.id);
  if (!result) return jsonError("not_found", "App not found", 404);
  return jsonOk(result);
});
