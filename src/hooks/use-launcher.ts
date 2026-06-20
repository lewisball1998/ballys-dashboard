"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppDTO, CategoryDTO } from "@/lib/types";
import { fetchApps, fetchCategories } from "./launcher-api";

export interface LauncherFilter {
  lifecycle: "active" | "all" | "retired";
  includeHidden: boolean;
}

/** Loads categories + apps for the launcher and exposes a reload(). */
export function useLauncher(filter: LauncherFilter) {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [apps, setApps] = useState<AppDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const [cats, appList] = await Promise.all([
      fetchCategories(),
      fetchApps({ lifecycle: filter.lifecycle, includeHidden: filter.includeHidden }),
    ]);
    if (cats.ok) setCategories(cats.data.items);
    else setError(cats.error.message);
    if (appList.ok) setApps(appList.data.items);
    else setError(appList.error.message);
    setLoading(false);
  }, [filter.lifecycle, filter.includeHidden]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { categories, apps, loading, error, reload };
}
