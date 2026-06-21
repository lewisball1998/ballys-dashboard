import { protectedRoute, jsonOk, jsonError, parseBody } from "@/server/api/respond";
import { customIconIdParamSchema } from "@/lib/validation";
import { deleteCustomIcon } from "@/server/services/custom-icons";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(customIconIdParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  if (!deleteCustomIcon(idRes.data.id)) return jsonError("not_found", "Icon not found", 404);
  return jsonOk({ id: idRes.data.id });
});
