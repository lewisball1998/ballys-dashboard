"use client";

import type { MetricPointDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMetrics } from "@/hooks/use-metrics";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBytes, formatBytesPerSec, formatDuration, formatPercent } from "@/lib/format";

function read(points: MetricPointDTO[], sourceId: string, metric: string): number | undefined {
  return points.find((p) => p.sourceId === sourceId && p.metric === metric)?.value;
}

function usageColor(percent: number): string {
  if (percent >= 90) return "bg-rose-500";
  if (percent >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function Tile({
  label,
  value,
  hint,
  percent,
}: {
  label: string;
  value: string;
  hint?: string;
  percent?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {percent !== undefined ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={cn("h-full rounded-full transition-all", usageColor(percent))}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      ) : null}
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="CPU"
          value={dash(cpu, formatPercent)}
          percent={cpu}
          hint={cpu === undefined ? "awaiting sample" : undefined}
        />
        <Tile
          label="Memory"
          value={dash(memPct, formatPercent)}
          percent={memPct}
          hint={memUsed !== undefined && memTotal !== undefined ? `${formatBytes(memUsed)} / ${formatBytes(memTotal)}` : undefined}
        />
        <Tile
          label="Storage"
          value={dash(storPct, formatPercent)}
          percent={storPct}
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
