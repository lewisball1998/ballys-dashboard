import { protectedRoute, jsonOk, parseJson } from "@/server/api/respond";
import { categoryCreateSchema } from "@/lib/validation";
import type { CategoryDTO, ListResult } from "@/lib/types";
import { createCategory, listCategories } from "@/server/services/categories";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  const items = listCategories();
  const body: ListResult<CategoryDTO> = { items, total: items.length };
  return jsonOk(body);
});

export const POST = protectedRoute(async (req) => {
  const parsed = await parseJson(req, categoryCreateSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(createCategory(parsed.data), 201);
});
