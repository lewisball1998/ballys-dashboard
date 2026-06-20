import type { Severity } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/badge";

/** Pure notification UI logic (no React) so it is unit-testable in node. */

/** Severity maps 1:1 onto a Badge tone (info/success/warning/error). */
export function severityTone(severity: Severity): BadgeTone {
  return severity;
}

export function severityLabel(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function formatCount(n: number): string {
  if (n <= 0) return "0";
  return n > 99 ? "99+" : String(n);
}

/** Compact relative time, e.g. "just now", "5m ago", "2h ago", "3d ago". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface NotificationFilter {
  unreadOnly: boolean;
  includeDismissed: boolean;
  severity: Severity | "all";
  source: string;
}

export const EMPTY_FILTER: NotificationFilter = {
  unreadOnly: false,
  includeDismissed: false,
  severity: "all",
  source: "",
};

/** Build the query string for GET /api/notifications from filter + paging. */
export function buildNotificationQuery(
  filter: NotificationFilter,
  paging: { limit?: number; offset?: number } = {},
): string {
  const params = new URLSearchParams();
  if (filter.unreadOnly) params.set("unread", "true");
  if (filter.includeDismissed) params.set("includeDismissed", "true");
  if (filter.severity !== "all") params.set("severity", filter.severity);
  if (filter.source.trim() !== "") params.set("source", filter.source.trim());
  if (paging.limit != null) params.set("limit", String(paging.limit));
  if (paging.offset != null) params.set("offset", String(paging.offset));
  return params.toString();
}
