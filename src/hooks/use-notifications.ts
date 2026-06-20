"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationDTO } from "@/lib/types";
import { buildNotificationQuery, type NotificationFilter } from "@/components/notifications/notifications-logic";
import { fetchNotifications } from "./notifications-api";

export function useNotifications(filter: NotificationFilter) {
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = buildNotificationQuery(filter, { limit: 100 });

  const reload = useCallback(async () => {
    setError(null);
    const res = await fetchNotifications(query);
    if (res.ok) {
      setItems(res.data.items);
      setTotal(res.data.total);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, total, loading, error, reload };
}
