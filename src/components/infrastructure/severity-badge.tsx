import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { HealthSeverity, TelemetrySourceStatus } from "@/lib/types";

/** Shared mapping from severity → calm badge tone + label + usage-bar colour. */

const SEVERITY_TONE: Record<HealthSeverity, BadgeTone> = {
  healthy: "success",
  warning: "warning",
  critical: "error",
  unavailable: "neutral",
};

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unavailable: "Unavailable",
};

const SEVERITY_BAR: Record<HealthSeverity, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  unavailable: "bg-foreground/25",
};

export function severityTone(severity: HealthSeverity): BadgeTone {
  return SEVERITY_TONE[severity];
}

export function severityBarClass(severity: HealthSeverity): string {
  return SEVERITY_BAR[severity];
}

export function SeverityBadge({ severity, label }: { severity: HealthSeverity; label?: string }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{label ?? SEVERITY_LABEL[severity]}</Badge>;
}

const SOURCE_TONE: Record<TelemetrySourceStatus, BadgeTone> = {
  available: "success",
  partial: "warning",
  unavailable: "neutral",
  not_configured: "neutral",
};

const SOURCE_LABEL: Record<TelemetrySourceStatus, string> = {
  available: "Connected",
  partial: "Partial",
  unavailable: "Unavailable",
  not_configured: "Not configured",
};

export function SourceStatusBadge({ status }: { status: TelemetrySourceStatus }) {
  return <Badge tone={SOURCE_TONE[status]}>{SOURCE_LABEL[status]}</Badge>;
}
