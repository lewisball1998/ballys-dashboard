import { protectedRoute, jsonOk, jsonError, parseBody, parseJson } from "@/server/api/respond";
import { appFavouriteSchema, idParamSchema } from "@/lib/validation";
import { setFavourite } from "@/server/services/apps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const parsed = await parseJson(req, appFavouriteSchema);
  if (!parsed.success) return parsed.response;

  const updated = setFavourite(idRes.data.id, parsed.data.isFavourite);
  if (!updated) return jsonError("not_found", "App not found", 404);
  return jsonOk(updated);
});
