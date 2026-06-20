"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetricPointDTO, MetricsResponseDTO } from "@/lib/types";
import { apiRequest } from "./api-client";

export function useMetrics(pollMs = 15_000) {
  const [points, setPoints] = useState<MetricPointDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await apiRequest<MetricsResponseDTO>("/api/metrics");
    if (res.ok) {
      setPoints(res.data.points);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, []);

  /** Trigger a server-side collection, then re-read. */
  const forceRefresh = useCallback(async () => {
    await apiRequest("/api/metrics/refresh", { method: "POST" });
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);

  return { points, loading, error, refresh, forceRefresh };
}
