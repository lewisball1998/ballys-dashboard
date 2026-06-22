"use client";

import type { TelemetrySourceDTO } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { SourceStatusBadge } from "./severity-badge";

/**
 * Telemetry source status row: makes it explicit whether each provider (local
 * system, Docker, TrueNAS) is connected, partial, or not configured, plus when
 * it last refreshed. Never alarming — an unconfigured source is informational.
 */
export function SourceStatus({ sources }: { sources: TelemetrySourceDTO[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sources.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-surface p-3.5 shadow-sm shadow-black/5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{s.label}</span>
            <SourceStatusBadge status={s.status} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{s.detail}</p>
          <p className="mt-2 text-[11px] text-muted/80">
            {s.lastRefresh ? `Updated ${formatRelativeTime(s.lastRefresh)}` : "No data yet"}
          </p>
        </div>
      ))}
    </div>
  );
}
