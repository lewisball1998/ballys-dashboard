"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HealthSeverity } from "@/lib/types";
import { SeverityBadge, severityBarClass } from "./severity-badge";

/**
 * Reusable infrastructure metric card. Shows a headline value with an optional
 * severity badge + usage bar, and — when `detail` is provided — an accessible
 * disclosure that expands an inline panel (drawer-style) for the deeper view.
 */
interface MetricCardProps {
  label: string;
  value: string;
  severity?: HealthSeverity;
  /** Sub-line under the value (e.g. "12.1 GB / 32 GB"). */
  hint?: ReactNode;
  /** 0–100 usage bar; omit for non-capacity metrics. */
  percent?: number | null;
  /** Expandable detail content. */
  detail?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, severity, hint, percent, detail, className }: MetricCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const barSeverity: HealthSeverity = severity ?? "healthy";

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
        {severity ? <SeverityBadge severity={severity} /> : null}
      </div>

      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>

      {percent !== undefined && percent !== null ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={cn("h-full rounded-full transition-all", severityBarClass(barSeverity))}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      ) : null}

      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}

      {detail ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
          >
            {open ? "Hide details" : "Details"}
            <span aria-hidden className={cn("transition-transform", open && "rotate-90")}>
              ›
            </span>
          </button>
          {open ? (
            <div id={panelId} className="mt-3 border-t border-border pt-3 text-sm">
              {detail}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** A small label/value row used inside detail panels. */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
