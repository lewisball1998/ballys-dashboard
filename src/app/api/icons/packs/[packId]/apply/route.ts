import { protectedRoute, jsonOk, jsonError, parseBody, parseJson } from "@/server/api/respond";
import { packIdParamSchema, packMatchApplySchema } from "@/lib/validation";
import { applyPackMatches } from "@/server/services/icon-packs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ packId: string }> };

/**
 * Bulk-apply user-vetted pack-icon → app assignments (v0.2.9). State-changing, so
 * POST only + `protectedRoute` (auth + same-origin CSRF). All safety (icon/app
 * existence, no-op detection, overwrite protection) is enforced in the service;
 * a missing pack is a 404. Returns a per-item outcome summary (partial success).
 */
export const POST = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(packIdParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;

  const parsed = await parseJson(req, packMatchApplySchema);
  if (!parsed.success) return parsed.response;

  const result = applyPackMatches(idRes.data.packId, parsed.data);
  if (!result) return jsonError("not_found", "Pack not found", 404);
  return jsonOk(result);
});
