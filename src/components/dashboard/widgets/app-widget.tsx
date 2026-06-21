"use client";

import type { ResolvedWidget } from "@/lib/types";
import { readAppId } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { useAppsCache } from "@/hooks/use-apps-cache";
import { AppIcon } from "@/components/launcher/app-icon";
import { healthLabel, healthTone } from "@/components/launcher/launcher-logic";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Generic, instanceable app widget (v0.2.4). Bound to an app via `config.appId`;
 * the card header already shows the app name (resolved server-side). The body
 * shows icon/initial, status (when health is enabled), category badge (when
 * available) and an Open button. Deleted apps render a calm "unavailable" state
 * and retired apps a muted state — never a crash. Reads app data from the shared
 * AppsCacheProvider so many app widgets share one fetch.
 */
export function AppWidget({ widget }: { widget: ResolvedWidget }) {
  const { getApp, getCategoryName, loading, error, reload } = useAppsCache();
  const appId = readAppId(widget.config);

  // Defensive: server validation + reconcile should prevent this from rendering.
  if (appId === null) {
    return (
      <EmptyState
        title="App widget misconfigured"
        description="This widget isn’t linked to an app. Remove it from Customise dashboard."
      />
    );
  }

  if (loading) return <LoadingState label="Loading app…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const app = getApp(appId);
  if (!app) {
    return (
      <EmptyState
        title="App unavailable"
        description="This app no longer exists. Remove this widget from Customise dashboard."
      />
    );
  }

  const retired = app.lifecycle === "retired";
  const categoryName = getCategoryName(app.categoryId);

  return (
    <div className={cn("flex items-center gap-3", retired && "opacity-60")}>
      <AppIcon icon={app.icon} name={app.name} className="h-10 w-10 text-sm" />

      <div className="min-w-0 flex-1">
        {app.description ? <p className="text-muted truncate text-xs">{app.description}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {retired ? <Badge tone="neutral">Retired</Badge> : null}
          {app.healthEnabled ? (
            <Badge tone={healthTone(app.latestHealth?.status)}>
              {healthLabel(app.latestHealth?.status)}
            </Badge>
          ) : null}
          {categoryName ? (
            <Badge tone="neutral" dot={false}>
              {categoryName}
            </Badge>
          ) : null}
        </div>
      </div>

      <a
        href={app.url}
        target={app.openNewTab ? "_blank" : undefined}
        rel="noreferrer"
        className="bg-accent text-accent-foreground shadow-accent/20 focus-visible:ring-accent/50 inline-flex h-8 shrink-0 items-center rounded-md px-3 text-xs font-medium shadow-sm transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
      >
        Open
      </a>
    </div>
  );
}
