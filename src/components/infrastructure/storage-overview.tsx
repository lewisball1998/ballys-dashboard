"use client";

import type { StoragePoolDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBytes, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge, severityBarClass } from "./severity-badge";

/**
 * Storage overview: one card per filesystem/pool with capacity, free space and a
 * capacity-severity bar. Pool health labels appear when a pool source provides
 * them (TrueNAS/ZFS — v0.4+); until then capacity severity stands in.
 */
export function StorageOverview({ pools }: { pools: StoragePoolDTO[] }) {
  if (pools.length === 0) {
    return (
      <EmptyState
        title="Storage telemetry unavailable"
        description="No mounted filesystems are visible to the dashboard. Mount a data volume or storage path to surface capacity here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {pools.map((p) => (
        <div key={p.name} className="rounded-xl border border-border bg-surface-2/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{p.name}</span>
              {p.isBoot ? (
                <Badge tone="info" dot={false}>
                  Boot
                </Badge>
              ) : null}
            </div>
            <SeverityBadge severity={p.severity} />
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {p.usagePercent !== null ? formatPercent(p.usagePercent) : "—"}
            </span>
            <span className="text-xs text-muted">
              {p.usedBytes !== null && p.totalBytes !== null
                ? `${formatBytes(p.usedBytes)} / ${formatBytes(p.totalBytes)}`
                : "—"}
            </span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className={cn("h-full rounded-full transition-all", severityBarClass(p.severity))}
              style={{ width: `${Math.min(100, Math.max(0, p.usagePercent ?? 0))}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>{p.health ? `Health: ${p.health}` : "Capacity-based status"}</span>
            <span>{p.freeBytes !== null ? `${formatBytes(p.freeBytes)} free` : ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
