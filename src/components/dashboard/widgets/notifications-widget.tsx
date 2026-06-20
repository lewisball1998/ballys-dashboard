"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { NotificationDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchNotifications } from "@/hooks/notifications-api";
import { onNotificationsChanged } from "@/hooks/notification-events";
import { formatRelativeTime, severityTone } from "@/components/notifications/notifications-logic";

/** Live preview of the most recent active notifications on the dashboard. */
export function NotificationsWidget() {
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchNotifications("limit=5");
    if (res.ok) {
      setItems(res.data.items);
      setError(null);
    } else {
      setError(res.error.message);
    }
  }, []);

  useEffect(() => {
    void load();
    const unsubscribe = onNotificationsChanged(() => void load());
    return unsubscribe;
  }, [load]);

  if (error && items === null) return <ErrorState message={error} onRetry={load} />;
  if (items === null) return <LoadingState label="Loading notifications…" />;
  if (items.length === 0) return <EmptyState title="No notifications" description="You are all caught up." />;

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div key={n.id} className="flex items-center gap-2 text-sm">
          <Badge tone={severityTone(n.severity)}>{n.severity}</Badge>
          <span className="min-w-0 flex-1 truncate">{n.title}</span>
          <span className="shrink-0 text-xs text-foreground/50">{formatRelativeTime(n.createdAt)}</span>
        </div>
      ))}
      <Link href="/notifications" className="inline-block text-xs text-accent hover:underline">
        View all
      </Link>
    </div>
  );
}
