import { protectedRoute, jsonOk, jsonError, parseBody, parseJson } from "@/server/api/respond";
import { appLifecycleActionSchema, idParamSchema } from "@/lib/validation";
import { applyLifecycle } from "@/server/services/apps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const parsed = await parseJson(req, appLifecycleActionSchema);
  if (!parsed.success) return parsed.response;

  const updated = applyLifecycle(idRes.data.id, parsed.data.action);
  if (!updated) return jsonError("not_found", "App not found", 404);
  return jsonOk(updated);
});
