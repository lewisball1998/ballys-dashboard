"use client";

import type { InfrastructureAlertDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Infrastructure alerts summary. Only real warning/critical conditions appear;
 * when there are none we show a calm "all clear" state rather than emptiness.
 */
export function InfrastructureAlerts({ alerts }: { alerts: InfrastructureAlertDTO[] }) {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.length - critical;

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">All systems healthy</p>
          <p className="text-xs text-muted">No infrastructure warnings or critical issues.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Active alerts</p>
        <p className="text-xs text-muted">
          {critical > 0 ? <span className="text-rose-500">{critical} critical</span> : null}
          {critical > 0 && warning > 0 ? " · " : null}
          {warning > 0 ? <span className="text-amber-500">{warning} warning</span> : null}
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              a.severity === "critical"
                ? "border-rose-500/30 bg-rose-500/[0.06]"
                : "border-amber-500/30 bg-amber-500/[0.06]",
            )}
          >
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                a.severity === "critical" ? "bg-rose-500" : "bg-amber-500",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{a.title}</p>
              <p className="text-xs text-muted">{a.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
