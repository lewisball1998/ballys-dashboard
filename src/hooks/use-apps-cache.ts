"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AppDTO } from "@/lib/types";
import { fetchApps, fetchCategories } from "@/hooks/launcher-api";

/**
 * Shared apps/categories cache for app widgets (v0.2.4). Many app widgets can sit
 * on one dashboard; this fetches the full app list (all lifecycles, incl. hidden,
 * so a pinned-but-hidden or retired app still resolves) and categories ONCE and
 * shares them, instead of one request per widget. The grid mounts the provider
 * only when at least one app widget is present, so dashboards without app widgets
 * pay nothing.
 */
interface AppsCache {
  /** The app for `id`, or undefined when it no longer exists (deleted). */
  getApp: (id: number) => AppDTO | undefined;
  /** Category name for an app's `categoryId`, or null when none/unknown. */
  getCategoryName: (id: number | null) => string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const AppsCacheContext = createContext<AppsCache | null>(null);

export function AppsCacheProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<Map<number, AppDTO> | null>(null);
  const [categoryNames, setCategoryNames] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [appsRes, catsRes] = await Promise.all([
      fetchApps({ lifecycle: "all", includeHidden: true }),
      fetchCategories(),
    ]);
    if (appsRes.ok) {
      setApps(new Map(appsRes.data.items.map((a) => [a.id, a])));
    } else {
      setApps(new Map());
      setError(appsRes.error.message);
    }
    // Categories are best-effort (badge enrichment only) — a failure here must
    // not block app widgets from rendering name/status/Open.
    if (catsRes.ok) {
      setCategoryNames(new Map(catsRes.data.items.map((c) => [c.id, c.name])));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value: AppsCache = {
    getApp: (id) => apps?.get(id),
    getCategoryName: (id) => (id == null ? null : (categoryNames.get(id) ?? null)),
    loading: apps === null,
    error,
    reload: () => void load(),
  };

  return createElement(AppsCacheContext.Provider, { value }, children);
}

export function useAppsCache(): AppsCache {
  const ctx = useContext(AppsCacheContext);
  if (!ctx) throw new Error("useAppsCache must be used within an AppsCacheProvider");
  return ctx;
}
