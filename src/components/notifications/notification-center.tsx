"use client";

import { useCallback, useState } from "react";
import type { Severity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useNotifications } from "@/hooks/use-notifications";
import { clearDismissed, dismissAll, markAllRead } from "@/hooks/notifications-api";
import { notifyNotificationsChanged } from "@/hooks/notification-events";
import { EMPTY_FILTER, type NotificationFilter } from "./notifications-logic";
import { NotificationItem } from "./notification-item";

const SEVERITIES: (Severity | "all")[] = ["all", "info", "success", "warning", "error"];

export function NotificationCenter() {
  const [filter, setFilter] = useState<NotificationFilter>(EMPTY_FILTER);
  const { items, total, loading, error, reload } = useNotifications(filter);

  const onChanged = useCallback(async () => {
    await reload();
    notifyNotificationsChanged();
  }, [reload]);

  const runBulk = async (fn: () => Promise<unknown>) => {
    await fn();
    await onChanged();
  };

  const set = <K extends keyof NotificationFilter>(key: K, value: NotificationFilter[K]) =>
    setFilter((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Notifications</h1>
          <p className="text-sm text-muted">Alerts and events ({total}).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => runBulk(markAllRead)}>
            Mark all read
          </Button>
          <Button variant="outline" size="sm" onClick={() => runBulk(dismissAll)}>
            Dismiss all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => runBulk(clearDismissed)}>
            Clear dismissed
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filter.unreadOnly} onChange={(e) => set("unreadOnly", e.target.checked)} />
          Unread only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filter.includeDismissed}
            onChange={(e) => set("includeDismissed", e.target.checked)}
          />
          Include dismissed
        </label>
        <Select
          aria-label="Severity filter"
          value={filter.severity}
          onChange={(e) => set("severity", e.target.value as NotificationFilter["severity"])}
          className="h-9 w-auto"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All severities" : s}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Source filter"
          value={filter.source}
          onChange={(e) => set("source", e.target.value)}
          placeholder="Filter by source"
          className="h-9 w-48"
        />
      </div>

      {loading && items.length === 0 ? (
        <LoadingState label="Loading notifications…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications" description="You are all caught up." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
