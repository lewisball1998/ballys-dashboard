import { protectedRoute, jsonOk, parseJson } from "@/server/api/respond";
import { appReorderSchema } from "@/lib/validation";
import type { AppDTO, ListResult } from "@/lib/types";
import { reorderApps } from "@/server/services/apps";

export const dynamic = "force-dynamic";

export const POST = protectedRoute(async (req) => {
  const parsed = await parseJson(req, appReorderSchema);
  if (!parsed.success) return parsed.response;
  const items = reorderApps(parsed.data);
  const body: ListResult<AppDTO> = { items, total: items.length };
  return jsonOk(body);
});
