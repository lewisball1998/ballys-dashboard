import { protectedRoute, jsonOk, jsonError, parseBody, parseJson } from "@/server/api/respond";
import { appUpdateSchema, idParamSchema } from "@/lib/validation";
import { deleteApp, getApp, updateApp } from "@/server/services/apps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const app = getApp(idRes.data.id);
  if (!app) return jsonError("not_found", "App not found", 404);
  return jsonOk(app);
});

export const PATCH = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  const parsed = await parseJson(req, appUpdateSchema);
  if (!parsed.success) return parsed.response;

  const updated = updateApp(idRes.data.id, parsed.data);
  if (!updated) return jsonError("not_found", "App not found", 404);
  return jsonOk(updated);
});

export const DELETE = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(idParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;
  if (!deleteApp(idRes.data.id)) return jsonError("not_found", "App not found", 404);
  return jsonOk({ id: idRes.data.id });
});
