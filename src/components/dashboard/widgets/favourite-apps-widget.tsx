"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppDTO } from "@/lib/types";
import { fetchApps } from "@/hooks/launcher-api";
import { AppIcon } from "@/components/launcher/app-icon";
import { healthLabel, healthTone } from "@/components/launcher/launcher-logic";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Quick Launch — compact list of apps marked as favourite, with status and an
 * Open action. Reuses launcher app data + health badge styling. Read-only: no
 * drag/reorder or layout editing (that is out of scope for v0.1.x).
 */
export function FavouriteAppsWidget() {
  const [apps, setApps] = useState<AppDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Active, visible apps only — a hidden app shouldn't show in quick launch.
    const res = await fetchApps({ lifecycle: "active", includeHidden: false });
    if (res.ok) {
      setApps(res.data.items);
      setError(null);
    } else {
      setError(res.error.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && apps === null) return <ErrorState message={error} onRetry={load} />;
  if (apps === null) return <LoadingState label="Loading favourites…" />;

  const favourites = apps.filter((app) => app.isFavourite);
  if (favourites.length === 0) {
    return (
      <EmptyState
        title="No favourite apps yet"
        description="Mark an app as a favourite from Apps to pin it here for quick launch."
      />
    );
  }

  return (
    <ul className="space-y-1.5">
      {favourites.map((app) => (
        <li
          key={app.id}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2/30 px-2.5 py-2"
        >
          <AppIcon icon={app.icon} name={app.name} className="h-7 w-7 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{app.name}</p>
            {app.healthEnabled ? (
              <Badge tone={healthTone(app.latestHealth?.status)} className="mt-0.5">
                {healthLabel(app.latestHealth?.status)}
              </Badge>
            ) : null}
          </div>
          <a
            href={app.url}
            target={app.openNewTab ? "_blank" : undefined}
            rel="noreferrer"
            className="inline-flex h-7 shrink-0 items-center rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground shadow-sm shadow-accent/20 transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Open
          </a>
        </li>
      ))}
    </ul>
  );
}
