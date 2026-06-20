import type { ScheduledJob } from "@/server/scheduler";
import { registry } from "@/modules";
import type { MetricPoint, ProviderContext } from "@/modules/types";
import { recordPoints, trimOldMetrics } from "@/server/services/metrics";
import { getSettings } from "@/server/services/settings";
import { events } from "@/server/events";
import type { ThresholdSettings } from "@/lib/types";

/**
 * Scheduler job: collect metrics from the core module's metric providers,
 * persist them, evaluate thresholds (emitting events that the DB sink persists),
 * and trim old rows per the retention setting.
 */
export function createSystemMetricsJob(intervalMs: number): ScheduledJob {
  return {
    id: "system-metrics",
    intervalMs,
    timeoutMs: Math.min(intervalMs, 30_000),
    async run(signal) {
      const ctx: ProviderContext = { signal, config: {}, instanceId: "core" };
      const core = registry.get("core");
      const points: MetricPoint[] = [];
      for (const provider of core?.capabilities.metrics ?? []) {
        points.push(...(await provider.collect(ctx)));
      }

      recordPoints(points, "system");

      const settings = getSettings();
      evaluateThresholds(points, settings.thresholds);
      trimOldMetrics(settings.metricRetentionDays);
    },
  };
}

function evaluateThresholds(points: MetricPoint[], thresholds: ThresholdSettings): void {
  check(points, "cpu", thresholds.cpuPercent, "CPU", "system.threshold.cpu");
  check(points, "memory", thresholds.memoryPercent, "Memory", "system.threshold.memory");
  check(points, "storage", thresholds.storagePercent, "Storage", "system.threshold.storage");
}

// Tracks which thresholds are currently breached so we notify once on breach
// and once on recovery (transition-based), not every tick.
const activeBreaches = new Set<string>();

function check(
  points: MetricPoint[],
  sourceId: string,
  threshold: number,
  label: string,
  dedupeKey: string,
): void {
  const point = points.find((p) => p.sourceId === sourceId && p.metric === "usage_percent");
  if (!point) return;

  const recoveredKey = `${dedupeKey}.recovered`;

  if (point.value > threshold) {
    if (!activeBreaches.has(dedupeKey)) {
      activeBreaches.add(dedupeKey);
      events.resetDedupe(recoveredKey);
      void events.emit({
        type: dedupeKey,
        severity: "warning",
        title: `High ${label.toLowerCase()} usage`,
        message: `${label} at ${point.value}% (threshold ${threshold}%)`,
        source: "system",
        dedupeKey,
      });
    }
  } else if (activeBreaches.has(dedupeKey)) {
    activeBreaches.delete(dedupeKey);
    events.resetDedupe(dedupeKey);
    void events.emit({
      type: recoveredKey,
      severity: "success",
      title: `${label} back to normal`,
      message: `${label} at ${point.value}% (threshold ${threshold}%)`,
      source: "system",
      dedupeKey: recoveredKey,
    });
  }
}
