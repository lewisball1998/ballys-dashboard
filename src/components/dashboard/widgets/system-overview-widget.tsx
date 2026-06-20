"use client";

import type { MetricPointDTO } from "@/lib/types";
import { useMetrics } from "@/hooks/use-metrics";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBytes, formatBytesPerSec, formatDuration, formatPercent } from "@/lib/format";

function read(points: MetricPointDTO[], sourceId: string, metric: string): number | undefined {
  return points.find((p) => p.sourceId === sourceId && p.metric === metric)?.value;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-3">
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="text-xs text-foreground/50">{hint}</p> : null}
    </div>
  );
}

export function SystemOverviewWidget() {
  const { points, loading, error, forceRefresh } = useMetrics();

  if (loading && points === null) return <LoadingState label="Loading metrics…" />;
  if (error && points === null) return <ErrorState message={error} onRetry={forceRefresh} />;
  if (!points || points.length === 0) {
    return (
      <EmptyState title="No metrics yet" description="The collector has not produced data.">
        <Button variant="outline" size="sm" onClick={forceRefresh}>
          Refresh
        </Button>
      </EmptyState>
    );
  }

  const cpu = read(points, "cpu", "usage_percent");
  const memPct = read(points, "memory", "usage_percent");
  const memUsed = read(points, "memory", "bytes_used");
  const memTotal = read(points, "memory", "bytes_total");
  const storPct = read(points, "storage", "usage_percent");
  const storUsed = read(points, "storage", "bytes_used");
  const storTotal = read(points, "storage", "bytes_total");
  const rx = read(points, "network", "rx_bytes_per_sec");
  const tx = read(points, "network", "tx_bytes_per_sec");
  const uptime = read(points, "uptime", "system_seconds");

  const dash = (v: number | undefined, fmt: (n: number) => string) =>
    v === undefined ? "—" : fmt(v);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="CPU" value={dash(cpu, formatPercent)} hint={cpu === undefined ? "awaiting sample" : undefined} />
        <Tile
          label="Memory"
          value={dash(memPct, formatPercent)}
          hint={memUsed !== undefined && memTotal !== undefined ? `${formatBytes(memUsed)} / ${formatBytes(memTotal)}` : undefined}
        />
        <Tile
          label="Storage"
          value={dash(storPct, formatPercent)}
          hint={storUsed !== undefined && storTotal !== undefined ? `${formatBytes(storUsed)} / ${formatBytes(storTotal)}` : undefined}
        />
        <Tile
          label="Network"
          value={rx === undefined && tx === undefined ? "—" : `↓ ${dash(rx, formatBytesPerSec)}`}
          hint={tx === undefined ? "awaiting sample" : `↑ ${formatBytesPerSec(tx)}`}
        />
        <Tile label="Uptime" value={dash(uptime, formatDuration)} />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={forceRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
