import { protectedRoute, jsonOk } from "@/server/api/respond";
import type { DockerImportCandidatesResponseDTO } from "@/lib/types";
import { getImportCandidates } from "@/server/services/docker-import";

export const dynamic = "force-dynamic";

/**
 * GET /api/docker/import/candidates — list containers as launcher-import
 * candidates with read-only hints + suggestions. Like the Command Centre list,
 * it always returns 200 with an `availability` field so the UI can render a clear
 * unavailable state. Server-side only; CSRF/auth via protectedRoute. Read-only —
 * it creates nothing.
 */
export const GET = protectedRoute(async () => {
  const body: DockerImportCandidatesResponseDTO = await getImportCandidates();
  return jsonOk(body);
});
