import { route, jsonOk, parseJson } from "@/server/api/respond";
import { categoryReorderSchema } from "@/lib/validation";
import type { CategoryDTO, ListResult } from "@/lib/types";
import { reorderCategories } from "@/server/services/categories";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const parsed = await parseJson(req, categoryReorderSchema);
  if (!parsed.success) return parsed.response;
  const items = reorderCategories(parsed.data.ids);
  const body: ListResult<CategoryDTO> = { items, total: items.length };
  return jsonOk(body);
});
