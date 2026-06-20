import type { ScheduledJob } from "@/server/scheduler";
import { listCheckableApps } from "@/server/services/apps";
import { checkApp, getLatestHealth } from "@/server/services/app-health";
import { events } from "@/server/events";

/**
 * Scheduler job: health-check apps that are enabled AND active (never retired or
 * health-disabled). Persists each result and emits deduped notifications on
 * transitions: a "down" notification when a check fails, and a "recovered"
 * notification when a previously-failing app comes back up. Dedupe keys are
 * reset across transitions so each new transition can notify once.
 */
export function createAppHealthJob(intervalMs: number): ScheduledJob {
  return {
    id: "app-health",
    intervalMs,
    timeoutMs: Math.min(intervalMs, 30_000),
    async run() {
      const checkable = listCheckableApps();
      for (const app of checkable) {
        try {
          const previous = getLatestHealth(app.id)?.status;
          const result = await checkApp(app);
          const downKey = `app.health.down.${app.id}`;
          const upKey = `app.health.recovered.${app.id}`;

          if (result.status === "down") {
            events.resetDedupe(upKey);
            void events.emit({
              type: "app.health.down",
              severity: "warning",
              title: `${app.name} is down`,
              message: result.message ?? undefined,
              source: "app-health",
              dedupeKey: downKey,
            });
          } else if (result.status === "up" && (previous === "down" || previous === "degraded")) {
            events.resetDedupe(downKey);
            void events.emit({
              type: "app.health.recovered",
              severity: "success",
              title: `${app.name} recovered`,
              source: "app-health",
              dedupeKey: upKey,
            });
          }
        } catch (error) {
          console.error(`[app-health] check failed for app ${app.id}:`, error);
        }
      }
    },
  };
}
