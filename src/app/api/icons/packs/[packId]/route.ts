import { protectedRoute, jsonOk, jsonError, parseBody } from "@/server/api/respond";
import { packIdParamSchema } from "@/lib/validation";
import { deleteIconPack } from "@/server/services/icon-packs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ packId: string }> };

export const DELETE = protectedRoute<Ctx>(async (req, ctx) => {
  const res = parseBody(packIdParamSchema, await ctx.params);
  if (!res.success) return res.response;
  if (!deleteIconPack(res.data.packId)) return jsonError("not_found", "Pack not found", 404);
  return jsonOk({ id: res.data.packId });
});
