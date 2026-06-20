"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationCountsDTO } from "@/lib/types";
import { fetchCounts } from "./notifications-api";
import { onNotificationsChanged } from "./notification-events";

/** Polls notification counts and refreshes when notifications change elsewhere. */
export function useNotificationCounts(pollMs = 30_000) {
  const [counts, setCounts] = useState<NotificationCountsDTO | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetchCounts();
    if (res.ok) setCounts(res.data);
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = onNotificationsChanged(() => void refresh());
    const timer = pollMs > 0 ? setInterval(() => void refresh(), pollMs) : null;
    return () => {
      unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [refresh, pollMs]);

  return { counts, refresh };
}
