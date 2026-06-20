import { sql } from "drizzle-orm";
import { route, jsonOk, jsonError } from "@/server/api/respond";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Readiness: the DB is reachable (and migrated). Public, no auth. */
export const GET = route(async () => {
  try {
    db.run(sql`select 1`);
    return jsonOk({ ready: true });
  } catch {
    return jsonError("not_ready", "Database not ready", 503);
  }
});
