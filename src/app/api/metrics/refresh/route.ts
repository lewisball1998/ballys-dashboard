import { protectedRoute, jsonOk, jsonError } from "@/server/api/respond";
import { scheduler } from "@/server/scheduler";

export const dynamic = "force-dynamic";

/** Trigger an immediate system-metrics collection (the scheduler "refresh now"). */
export const POST = protectedRoute(async () => {
  try {
    await scheduler.runNow("system-metrics");
  } catch {
    return jsonError("job_unavailable", "Metrics collector is not running", 503);
  }
  return jsonOk({ refreshed: true });
});
