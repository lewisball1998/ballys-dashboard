"use client";

import type { NasDatasetDTO, NasPoolDTO, NasTelemetryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBytes, formatPercent, formatRelativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge, severityBarClass } from "./severity-badge";
import { DriveInventory } from "./drive-inventory";

/**
 * NAS storage (TrueNAS, read-only): pools with health + capacity, datasets, and a
 * disk inventory with temperature / SMART where the NAS reports it. Rendered only
 * when a NAS source is configured, and kept visually distinct from the local
 * filesystems above so NAS and app/container storage are never conflated.
 *
 * A configured-but-unreachable NAS shows a calm unavailable state — never an
 * alarming error — and the rest of the page is unaffected.
 */

function NasPoolCard({ pool }: { pool: NasPoolDTO }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{pool.name}</span>
        <SeverityBadge severity={pool.severity} />
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {pool.usagePercent !== null ? formatPercent(pool.usagePercent) : "—"}
        </span>
        <span className="text-xs text-muted">
          {pool.usedBytes !== null && pool.totalBytes !== null
            ? `${formatBytes(pool.usedBytes)} / ${formatBytes(pool.totalBytes)}`
            : "—"}
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn("h-full rounded-full transition-all", severityBarClass(pool.severity))}
          style={{ width: `${Math.min(100, Math.max(0, pool.usagePercent ?? 0))}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{pool.health ? `Status: ${pool.health}` : "NAS pool"}</span>
        <span>{pool.freeBytes !== null ? `${formatBytes(pool.freeBytes)} free` : ""}</span>
      </div>
    </div>
  );
}

function DatasetList({ datasets }: { datasets: NasDatasetDTO[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Datasets</p>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface-2/40">
        {datasets.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="truncate font-mono text-xs text-foreground">{d.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {d.usedBytes !== null && d.totalBytes !== null
                ? `${formatBytes(d.usedBytes)} / ${formatBytes(d.totalBytes)}`
                : d.usedBytes !== null
                  ? formatBytes(d.usedBytes)
                  : "—"}
              {d.usagePercent !== null ? ` · ${formatPercent(d.usagePercent)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NasStorage({ nas }: { nas: NasTelemetryDTO }) {
  const hasData = nas.pools.length > 0 || nas.datasets.length > 0 || nas.disks.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        title={nas.status === "unavailable" ? "TrueNAS unavailable" : "No NAS telemetry yet"}
        description={
          nas.status === "unavailable"
            ? "TrueNAS is configured but could not be reached. The rest of the page is unaffected."
            : "Connected to TrueNAS, but no pools, datasets or disks were returned."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {nas.pools.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {nas.pools.map((p) => (
            <NasPoolCard key={p.name} pool={p} />
          ))}
        </div>
      ) : null}

      {nas.datasets.length > 0 ? <DatasetList datasets={nas.datasets} /> : null}

      {nas.disks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">NAS disks</p>
          <DriveInventory drives={nas.disks} />
        </div>
      ) : null}

      <p className="text-[11px] text-muted">
        Read-only TrueNAS telemetry — pools, datasets, disks, temperature &amp; SMART where
        available. Serials are masked.
        {nas.lastRefresh ? ` Updated ${formatRelativeTime(nas.lastRefresh)}.` : ""}
      </p>
    </div>
  );
}
