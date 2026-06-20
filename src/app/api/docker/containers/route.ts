import { protectedRoute, jsonOk } from "@/server/api/respond";
import type { DockerContainersResponseDTO } from "@/lib/types";
import { getDockerContainers } from "@/server/services/docker";

export const dynamic = "force-dynamic";

/**
 * GET /api/docker/containers — list + group containers. Always returns 200 with
 * an `availability` field; when Docker is not configured/reachable the body
 * carries the reason so the UI can render a clear unavailable state rather than
 * surfacing an error. Server-side only; CSRF/auth via protectedRoute.
 */
export const GET = protectedRoute(async () => {
  const body: DockerContainersResponseDTO = await getDockerContainers();
  return jsonOk(body);
});
