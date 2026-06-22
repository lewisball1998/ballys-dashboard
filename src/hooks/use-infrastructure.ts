"use client";

import { useCallback, useEffect, useState } from "react";
import type { InfrastructureTelemetryDTO } from "@/lib/types";
import { apiRequest } from "./api-client";

/**
 * Polls GET /api/infrastructure. The endpoint always returns a valid (possibly
 * degraded) document, so `error` only reflects transport/auth failures; missing
 * telemetry surfaces as `unavailable` states inside the data itself.
 */
export function useInfrastructure(pollMs = 15_000) {
  const [data, setData] = useState<InfrastructureTelemetryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await apiRequest<InfrastructureTelemetryDTO>("/api/infrastructure");
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);

  return { data, loading, error, refresh };
}
