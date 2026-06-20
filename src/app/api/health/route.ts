import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Liveness endpoint. Used by the Docker HEALTHCHECK and as a smoke test that the
 * API layer is up. Kept dependency-free (no DB call) so it stays a pure
 * liveness probe; a readiness probe that checks the DB can be added in Phase 1.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    version: APP_VERSION,
    time: new Date().toISOString(),
  });
}
