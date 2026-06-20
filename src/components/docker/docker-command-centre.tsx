"use client";

import { useMemo } from "react";
import type { DockerContainerDTO } from "@/lib/types";
import { useDocker } from "@/hooks/use-docker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ContainerCard } from "./container-card";
import { unavailableCopy } from "./docker-logic";

function flatten(groups: { containers: DockerContainerDTO[] }[]): DockerContainerDTO[] {
  return groups.flatMap((g) => g.containers);
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function DockerCommandCentre() {
  const { data, loading, error, refresh, runAction } = useDocker();

  const summary = useMemo(() => {
    const all = data ? flatten(data.groups) : [];
    return {
      total: all.length,
      running: all.filter((c) => c.state === "running").length,
      stopped: all.filter((c) => c.state === "exited" || c.state === "dead" || c.state === "created").length,
      restarting: all.filter((c) => c.state === "restarting").length,
      unhealthy: all.filter((c) => c.health === "unhealthy").length,
    };
  }, [data]);

  if (loading && data === null) return <LoadingState label="Loading containers…" />;
  if (error && data === null) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  if (!data.availability.available) {
    const copy = unavailableCopy(data.availability.reason);
    return (
      <Card className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="max-w-prose text-sm text-muted">{copy.description}</p>
          {data.availability.message ? (
            <p className="max-w-prose text-xs text-muted/80">Details: {data.availability.message}</p>
          ) : null}
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <EmptyState
        title="No containers found"
        description="Docker is connected, but there are no containers to show yet."
      >
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total" value={summary.total} />
          <Stat label="Running" value={summary.running} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Stopped" value={summary.stopped} />
          <Stat label="Restarting" value={summary.restarting} tone={summary.restarting ? "text-amber-600 dark:text-amber-400" : undefined} />
          <Stat label="Unhealthy" value={summary.unhealthy} tone={summary.unhealthy ? "text-rose-600 dark:text-rose-400" : undefined} />
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {data.groups.map((group) => (
        <section key={group.project ?? "__standalone__"} className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {group.project ?? "Standalone containers"}
            </h2>
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted">
              {group.containers.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.containers.map((container) => (
              <ContainerCard key={container.id} container={container} onAction={runAction} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
