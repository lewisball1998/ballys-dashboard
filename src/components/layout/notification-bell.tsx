"use client";

import Link from "next/link";
import { useNotificationCounts } from "@/hooks/use-notification-counts";
import { formatCount } from "@/components/notifications/notifications-logic";

export function NotificationBell() {
  const { counts } = useNotificationCounts();
  const unread = counts?.unread ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-foreground/5"
    >
      <span aria-hidden className="text-lg leading-none">
        🔔
      </span>
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
          {formatCount(unread)}
        </span>
      ) : null}
    </Link>
  );
}
