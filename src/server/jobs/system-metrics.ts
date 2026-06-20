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

function check(
  points: MetricPoint[],
  sourceId: string,
  threshold: number,
  label: string,
  dedupeKey: string,
): void {
  const point = points.find((p) => p.sourceId === sourceId && p.metric === "usage_percent");
  if (!point) return;

  if (point.value > threshold) {
    void events.emit({
      type: dedupeKey,
      severity: "warning",
      title: `High ${label.toLowerCase()} usage`,
      message: `${label} at ${point.value}% (threshold ${threshold}%)`,
      source: "system",
      dedupeKey,
    });
  } else {
    // Back under threshold — clear the dedupe key so the next breach notifies.
    events.resetDedupe(dedupeKey);
  }
}
