import { route, jsonOk, jsonError, parseBody, parseJson } from "@/server/api/respond";
import { categoryUpdateSchema, idParamSchema } from "@/lib/validation";
import { deleteCategory, updateCategory } from "@/server/services/categories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const parsed = await parseJson(req, categoryUpdateSchema);
  if (!parsed.success) return parsed.response;

  const updated = updateCategory(idRes.data.id, parsed.data);
  if (!updated) return jsonError("not_found", "Category not found", 404);
  return jsonOk(updated);
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;

  if (!deleteCategory(idRes.data.id)) return jsonError("not_found", "Category not found", 404);
  return jsonOk({ id: idRes.data.id });
});
