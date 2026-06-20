import { route, jsonOk, jsonError, parseBody } from "@/server/api/respond";
import { idParamSchema } from "@/lib/validation";
import { dismiss } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const updated = dismiss(idRes.data.id);
  if (!updated) return jsonError("not_found", "Notification not found", 404);
  return jsonOk(updated);
});
