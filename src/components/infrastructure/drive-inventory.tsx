"use client";

import type { DriveDTO, HealthSeverity, SmartStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBytes, formatTempC } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Drive inventory: model, type, size, temperature, SMART health and a redacted
 * serial per drive. Renders a table on wider screens and stacked cards on
 * mobile. SMART verdicts show "N/A" until a SMART source is available (v0.4+).
 */

const TEMP_TEXT: Record<HealthSeverity, string> = {
  healthy: "text-foreground",
  warning: "text-amber-500",
  critical: "text-rose-500",
  unavailable: "text-muted",
};

function tempText(d: DriveDTO): string {
  return d.temperatureC !== null ? formatTempC(d.temperatureC) : "—";
}

function TypeBadge({ type }: { type: DriveDTO["type"] }) {
  return (
    <Badge tone={type === "unknown" ? "neutral" : "info"} dot={false}>
      {type.toUpperCase()}
    </Badge>
  );
}

function SmartBadge({ status }: { status: SmartStatus }) {
  if (status === "passed") return <Badge tone="success">Passed</Badge>;
  if (status === "failing") return <Badge tone="error">Failing</Badge>;
  return (
    <Badge tone="neutral" dot={false}>
      N/A
    </Badge>
  );
}

export function DriveInventory({ drives }: { drives: DriveDTO[] }) {
  if (drives.length === 0) {
    return (
      <EmptyState
        title="No drives visible"
        description="Drive inventory needs host disk visibility (e.g. a read-only /sys mount). It is hidden, not failing."
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">Drive</th>
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium">Size</th>
              <th className="py-2 pr-3 font-medium">Temp</th>
              <th className="py-2 pr-3 font-medium">SMART</th>
              <th className="py-2 font-medium">Serial</th>
            </tr>
          </thead>
          <tbody>
            {drives.map((d) => (
              <tr key={d.name} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-foreground">{d.name}</td>
                <td className="py-2.5 pr-3 text-muted">{d.model ?? "—"}</td>
                <td className="py-2.5 pr-3">
                  <TypeBadge type={d.type} />
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted">
                  {d.sizeBytes !== null ? formatBytes(d.sizeBytes) : "—"}
                </td>
                <td className={cn("py-2.5 pr-3 font-medium tabular-nums", TEMP_TEXT[d.temperatureSeverity])}>
                  {tempText(d)}
                </td>
                <td className="py-2.5 pr-3">
                  <SmartBadge status={d.smartStatus} />
                </td>
                <td className="py-2.5 font-mono text-xs text-muted">{d.serial ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {drives.map((d) => (
          <div key={d.name} className="rounded-xl border border-border bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{d.name}</span>
              <div className="flex items-center gap-2">
                <TypeBadge type={d.type} />
                <SmartBadge status={d.smartStatus} />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">{d.model ?? "Unknown model"}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted">Size</p>
                <p className="font-medium tabular-nums text-foreground">
                  {d.sizeBytes !== null ? formatBytes(d.sizeBytes) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted">Temp</p>
                <p className={cn("font-medium tabular-nums", TEMP_TEXT[d.temperatureSeverity])}>
                  {tempText(d)}
                </p>
              </div>
              <div>
                <p className="text-muted">Serial</p>
                <p className="truncate font-mono text-foreground">{d.serial ?? "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
