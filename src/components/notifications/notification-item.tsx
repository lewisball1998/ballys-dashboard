"use client";

import { useState } from "react";
import type { NotificationDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dismiss, markRead } from "@/hooks/notifications-api";
import { formatRelativeTime, severityLabel, severityTone } from "./notifications-logic";

interface NotificationItemProps {
  notification: NotificationDTO;
  onChanged: () => void;
}

export function NotificationItem({ notification, onChanged }: NotificationItemProps) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn("flex items-start gap-3", notification.read ? "opacity-70" : undefined)}>
      {!notification.read && !notification.dismissed ? (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
      ) : (
        <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={severityTone(notification.severity)}>{severityLabel(notification.severity)}</Badge>
          <span className="text-sm font-medium">{notification.title}</span>
          {notification.dismissed ? <Badge tone="neutral">Dismissed</Badge> : null}
        </div>
        {notification.message ? (
          <p className="mt-1 text-sm text-foreground/70">{notification.message}</p>
        ) : null}
        <p className="mt-1 text-xs text-foreground/50">
          {notification.source ? `${notification.source} · ` : ""}
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!notification.read && !notification.dismissed ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => markRead(notification.id))}>
            Mark read
          </Button>
        ) : null}
        {!notification.dismissed ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => dismiss(notification.id))}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
