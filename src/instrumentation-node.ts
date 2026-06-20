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
import { events } from "@/server/events";
import { dbNotificationSink } from "@/server/events/db-sink";
import { seedSettings, getSettings } from "@/server/services/settings";
import { createSystemMetricsJob } from "@/server/jobs/system-metrics";
import { createAppHealthJob } from "@/server/jobs/app-health";
import { cleanupExpiredSessions } from "@/server/auth/session";

let registered = false;

export function registerNode(): void {
  if (registered) return;
  registered = true;

  runMigrations();
  initializeModules();
  seedSettings();
  cleanupExpiredSessions();

  // Persist events (e.g. threshold breaches) as notifications.
  events.addSink(dbNotificationSink);

  // Register collection jobs, then start the scheduler.
  const { systemMetricIntervalMs, appHealthIntervalMs } = getSettings();
  scheduler.register(createSystemMetricsJob(systemMetricIntervalMs));
  scheduler.register(createAppHealthJob(appHealthIntervalMs));
  scheduler.start();

  console.log("[boot] Bally's Dashboard engines initialised");
}
