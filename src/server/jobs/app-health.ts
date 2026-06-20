import type { ScheduledJob } from "@/server/scheduler";
import { listCheckableApps } from "@/server/services/apps";
import { checkApp } from "@/server/services/app-health";
import { events } from "@/server/events";

/**
 * Scheduler job: health-check apps that are enabled AND active (never retired or
 * health-disabled). Persists each result and emits a minimal, deduped "down"
 * notification per app (recovery clears the dedupe key).
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
          const result = await checkApp(app);
          const dedupeKey = `app.health.down.${app.id}`;
          if (result.status === "down") {
            void events.emit({
              type: "app.health.down",
              severity: "warning",
              title: `${app.name} is down`,
              message: result.message ?? undefined,
              source: "app-health",
              dedupeKey,
            });
          } else {
            events.resetDedupe(dedupeKey);
          }
        } catch (error) {
          console.error(`[app-health] check failed for app ${app.id}:`, error);
        }
      }
    },
  };
}
