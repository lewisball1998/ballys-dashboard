"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResponse, AppSettingsDTO } from "@/lib/types";
import type { SettingsUpdateInput } from "@/lib/validation";
import { apiRequest } from "./api-client";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiRequest<AppSettingsDTO>("/api/settings");
    if (res.ok) setSettings(res.data);
    else setError(res.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (patch: SettingsUpdateInput): Promise<ApiResponse<AppSettingsDTO>> => {
      const res = await apiRequest<AppSettingsDTO>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (res.ok) setSettings(res.data);
      return res;
    },
    [],
  );

  return { settings, loading, error, reload, save };
}
