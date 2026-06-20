import { protectedRoute, jsonOk, jsonError, parseBody, parseJson } from "@/server/api/respond";
import { dockerContainerIdSchema, dockerActionSchema } from "@/lib/validation";
import { runContainerAction } from "@/server/services/docker";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/docker/containers/:id/action — start | stop | restart.
 *
 * The container id is strictly validated (hex 12–64) BEFORE any privileged
 * Engine call, the action is enum-validated, and the route is POST-only with
 * CSRF + auth (protectedRoute). No other Docker operations are reachable.
 */
export const POST = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(dockerContainerIdSchema, await ctx.params);
  if (!idRes.success) return idRes.response;

  const parsed = await parseJson(req, dockerActionSchema);
  if (!parsed.success) return parsed.response;

  const outcome = await runContainerAction(idRes.data.id, parsed.data.action);
  if (outcome.ok) return jsonOk(outcome.result);

  switch (outcome.kind) {
    case "not_found":
      return jsonError("not_found", "Container not found", 404);
    case "conflict":
      return jsonError("conflict", outcome.message, 409);
    case "unavailable":
      return jsonError(
        "docker_unavailable",
        outcome.availability.available ? "Docker unavailable" : outcome.availability.message,
        503,
      );
    case "engine_error":
      return jsonError("docker_error", outcome.message, 502);
  }
});
