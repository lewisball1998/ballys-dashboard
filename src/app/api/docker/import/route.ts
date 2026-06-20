import { protectedRoute, jsonOk, parseJson } from "@/server/api/respond";
import { dockerImportSchema } from "@/lib/validation";
import { importApps } from "@/server/services/docker-import";

export const dynamic = "force-dynamic";

/**
 * POST /api/docker/import — create launcher apps from a vetted selection of
 * Docker containers. Each item is validated as a normal app-create payload
 * (required http(s) URL etc.) plus its source container id. Duplicates are
 * skipped (never silently created); the response summarises imported / skipped /
 * failed. POST-only with CSRF + auth (protectedRoute). State change stays here on
 * the server.
 */
export const POST = protectedRoute(async (req) => {
  const parsed = await parseJson(req, dockerImportSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(importApps(parsed.data), 201);
});
