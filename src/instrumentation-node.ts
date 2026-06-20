/**
 * Node.js-only boot work. Kept in a SEPARATE module (not inlined into
 * instrumentation.ts) so it is reachable only via the dynamic import behind the
 * `NEXT_RUNTIME === "nodejs"` guard. This keeps native deps (better-sqlite3,
 * which pulls in `fs`) out of the Edge-runtime compilation of the instrumentation
 * hook — otherwise Next tries to bundle `fs` for Edge and the build fails.
 */
import { runMigrations } from "@/db/migrate";
import { initializeModules } from "@/modules";
import { scheduler } from "@/server/scheduler";

export function registerNode(): void {
  runMigrations();
  initializeModules();
  scheduler.start();
  console.log("[boot] Bally's Dashboard engines initialised");
}
