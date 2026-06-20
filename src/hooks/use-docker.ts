"use client";

import { useCallback, useEffect, useState } from "react";
import type { DockerAction, DockerContainersResponseDTO } from "@/lib/types";
import { containerAction, fetchContainers } from "./docker-api";

interface UseDockerResult {
  data: DockerContainersResponseDTO | null;
  loading: boolean;
  /** Transport-level error (the daemon being unavailable is NOT an error — it
   * comes back inside `data.availability`). */
  error: string | null;
  refresh: () => Promise<void>;
  runAction: (id: string, action: DockerAction) => Promise<{ ok: boolean; message?: string }>;
}

export function useDocker(pollMs = 10_000): UseDockerResult {
  const [data, setData] = useState<DockerContainersResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetchContainers();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, []);

  const runAction = useCallback(
    async (id: string, action: DockerAction) => {
      const res = await containerAction(id, action);
      // Re-read immediately so the UI reflects the new state regardless of
      // outcome (e.g. a restart leaves it running again).
      await refresh();
      return res.ok ? { ok: true } : { ok: false, message: res.error.message };
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);

  return { data, loading, error, refresh, runAction };
}
