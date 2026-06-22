import { protectedRoute, jsonOk } from "@/server/api/respond";
import type { InfrastructureTelemetryDTO } from "@/lib/types";
import { collectInfrastructureTelemetry } from "@/server/telemetry/service";

/**
 * GET /api/infrastructure — normalised, redacted infrastructure & hardware
 * telemetry (v0.3.0). The service reads only read-only local sources plus the
 * opt-in Docker socket and never throws, so this route always returns a valid
 * (possibly degraded) telemetry document.
 */
export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  const body: InfrastructureTelemetryDTO = await collectInfrastructureTelemetry();
  return jsonOk(body);
});
