"use client";

import type {
  ConsumerDTO,
  CpuTelemetryDTO,
  GpuTelemetryDTO,
  MemoryTelemetryDTO,
  NetworkTelemetryDTO,
  StorageTelemetryDTO,
  UptimeTelemetryDTO,
} from "@/lib/types";
import {
  formatBytes,
  formatBytesPerSec,
  formatClockMhz,
  formatDuration,
  formatPercent,
  formatTempC,
  formatWatts,
} from "@/lib/format";
import { MetricCard, DetailRow } from "./metric-card";
import { SeverityBadge } from "./severity-badge";

/** Format a metric, rendering missing/invalid readings (null, undefined, NaN,
 * Infinity) as "—". Note 0 is a valid reading (e.g. 0% usage) and is formatted. */
const dash = (v: number | null | undefined, fmt: (n: number) => string) =>
  v == null || !Number.isFinite(v) ? "—" : fmt(v);

/** Top resource consumers, grouped by container/app (server-summarised). */
function ConsumerList({ items, kind }: { items: ConsumerDTO[]; kind: "cpu" | "memory" }) {
  if (items.length === 0) {
    return <p className="mt-2 text-xs text-muted">Per-app usage needs the Docker socket.</p>;
  }
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Top apps</p>
      {items.map((c) => (
        <DetailRow
          key={c.name}
          label={c.name}
          value={
            kind === "cpu"
              ? dash(c.usagePercent, formatPercent)
              : dash(c.bytes, formatBytes)
          }
        />
      ))}
    </div>
  );
}

export function CpuCard({ cpu }: { cpu: CpuTelemetryDTO }) {
  const load = cpu.loadAverage;
  return (
    <MetricCard
      label="CPU"
      value={dash(cpu.usagePercent, formatPercent)}
      severity={cpu.severity}
      percent={cpu.usagePercent}
      hint={load ? `Load ${load.map((n) => n.toFixed(2)).join(" · ")}` : undefined}
      detail={
        <>
          <DetailRow label="Cores / threads" value={cpu.cores ?? "—"} />
          <DetailRow label="Model" value={cpu.model ?? "—"} />
          <DetailRow label="Clock" value={formatClockMhz(cpu.clockMhz)} />
          <DetailRow
            label="Temperature"
            value={
              cpu.temperatureC !== null ? (
                <span className="inline-flex items-center gap-2">
                  {formatTempC(cpu.temperatureC)}
                  <SeverityBadge severity={cpu.temperatureSeverity} />
                </span>
              ) : (
                "—"
              )
            }
          />
          <ConsumerList items={cpu.topConsumers} kind="cpu" />
        </>
      }
    />
  );
}

export function MemoryCard({ memory }: { memory: MemoryTelemetryDTO }) {
  return (
    <MetricCard
      label="Memory"
      value={dash(memory.usagePercent, formatPercent)}
      severity={memory.severity}
      percent={memory.usagePercent}
      hint={
        memory.usedBytes !== null && memory.totalBytes !== null
          ? `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`
          : undefined
      }
      detail={
        <>
          <DetailRow label="Available" value={dash(memory.availableBytes, formatBytes)} />
          <DetailRow label="Cached" value={dash(memory.cachedBytes, formatBytes)} />
          <DetailRow label="Buffers" value={dash(memory.buffersBytes, formatBytes)} />
          <DetailRow
            label="Swap"
            value={
              memory.swapTotalBytes && memory.swapTotalBytes > 0
                ? `${formatBytes(memory.swapUsedBytes ?? 0)} / ${formatBytes(memory.swapTotalBytes)}`
                : "—"
            }
          />
          <ConsumerList items={memory.topConsumers} kind="memory" />
        </>
      }
    />
  );
}

export function GpuCard({ gpu }: { gpu: GpuTelemetryDTO }) {
  const first = gpu.devices[0];
  if (!first) {
    return (
      <MetricCard
        label="GPU"
        value="—"
        severity="unavailable"
        hint="No GPU detected or telemetry unavailable."
      />
    );
  }
  return (
    <MetricCard
      label="GPU"
      value={dash(first.utilisationPercent, formatPercent)}
      severity={first.severity}
      percent={first.utilisationPercent}
      hint={first.name}
      detail={
        <>
          {gpu.devices.map((d) => (
            <div key={d.name} className="mb-2 last:mb-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{d.name}</p>
              <DetailRow label="Utilisation" value={dash(d.utilisationPercent, formatPercent)} />
              <DetailRow
                label="VRAM"
                value={
                  d.vramTotalBytes !== null
                    ? `${formatBytes(d.vramUsedBytes ?? 0)} / ${formatBytes(d.vramTotalBytes)}`
                    : "—"
                }
              />
              <DetailRow label="Temperature" value={dash(d.temperatureC, formatTempC)} />
              <DetailRow label="Power" value={dash(d.powerWatts, formatWatts)} />
              <DetailRow label="Driver" value={d.driver ?? "—"} />
            </div>
          ))}
        </>
      }
    />
  );
}

export function NetworkCard({ network }: { network: NetworkTelemetryDTO }) {
  const hasIfaces = network.interfaces.length > 0;
  return (
    <MetricCard
      label="Network"
      value={network.rxBytesPerSec !== null ? `↓ ${formatBytesPerSec(network.rxBytesPerSec)}` : "—"}
      severity={hasIfaces ? "healthy" : "unavailable"}
      hint={
        network.txBytesPerSec !== null
          ? `↑ ${formatBytesPerSec(network.txBytesPerSec)}`
          : "awaiting sample"
      }
      detail={
        hasIfaces ? (
          <div className="space-y-3">
            {network.interfaces.map((i) => (
              <div key={i.name}>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{i.name}</p>
                <DetailRow
                  label="Throughput"
                  value={`↓ ${dash(i.rxBytesPerSec, formatBytesPerSec)} · ↑ ${dash(i.txBytesPerSec, formatBytesPerSec)}`}
                />
                <DetailRow
                  label="Total since boot"
                  value={`↓ ${formatBytes(i.rxTotalBytes)} · ↑ ${formatBytes(i.txTotalBytes)}`}
                />
                <DetailRow
                  label="Errors / drops"
                  value={`${i.rxErrors + i.txErrors} err · ${i.rxDropped + i.txDropped} drop`}
                />
              </div>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

export function StorageSummaryCard({ storage }: { storage: StorageTelemetryDTO }) {
  const totals = storage.pools.reduce(
    (acc, p) => {
      acc.total += p.totalBytes ?? 0;
      acc.used += p.usedBytes ?? 0;
      return acc;
    },
    { total: 0, used: 0 },
  );
  const pct = totals.total > 0 ? Math.round((1000 * totals.used) / totals.total) / 10 : null;
  const hottest = storage.drives
    .filter((d) => d.temperatureC !== null)
    .sort((a, b) => (b.temperatureC ?? 0) - (a.temperatureC ?? 0))[0];

  return (
    <MetricCard
      label="Storage"
      value={pct !== null ? formatPercent(pct) : "—"}
      severity={storage.severity}
      percent={pct}
      hint={
        totals.total > 0 ? `${formatBytes(totals.used)} / ${formatBytes(totals.total)}` : undefined
      }
      detail={
        <>
          <DetailRow label="Pools / filesystems" value={storage.pools.length} />
          <DetailRow label="Drives" value={storage.drives.length} />
          <DetailRow
            label="Hottest drive"
            value={
              hottest && hottest.temperatureC !== null
                ? `${hottest.name} · ${formatTempC(hottest.temperatureC)}`
                : "—"
            }
          />
        </>
      }
    />
  );
}

export function UptimeCard({ uptime }: { uptime: UptimeTelemetryDTO }) {
  return (
    <MetricCard
      label="Uptime"
      value={dash(uptime.systemSeconds, formatDuration)}
      hint={
        uptime.processSeconds !== null ? `App ${formatDuration(uptime.processSeconds)}` : undefined
      }
    />
  );
}
