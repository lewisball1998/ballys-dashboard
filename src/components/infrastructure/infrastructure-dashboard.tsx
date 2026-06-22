"use client";

import type { ReactNode } from "react";
import { useInfrastructure } from "@/hooks/use-infrastructure";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { SourceStatus } from "./source-status";
import { InfrastructureAlerts } from "./infrastructure-alerts";
import { StorageOverview } from "./storage-overview";
import { DriveInventory } from "./drive-inventory";
import {
  CpuCard,
  GpuCard,
  MemoryCard,
  NetworkCard,
  StorageSummaryCard,
  UptimeCard,
} from "./hardware-cards";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A calm, layout-matching placeholder shown on first load so the page reads as
 * "loading" rather than broken while server-side telemetry is collected. */
function SkeletonGrid({ count, cols, height }: { count: number; cols: string; height: string }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-xl border border-border bg-surface`} />
      ))}
    </div>
  );
}

function InfrastructureSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading infrastructure telemetry…</span>
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-foreground/10" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-foreground/10" />
      </div>
      <Section title="Telemetry sources" description="Where this data comes from and whether it is connected.">
        <SkeletonGrid count={3} cols="sm:grid-cols-2 lg:grid-cols-3" height="h-24" />
      </Section>
      <Section title="Hardware" description="Click a card for the detailed view.">
        <SkeletonGrid count={6} cols="sm:grid-cols-2 xl:grid-cols-3" height="h-32" />
      </Section>
      <Section title="Storage" description="Capacity and health per filesystem / pool.">
        <SkeletonGrid count={3} cols="md:grid-cols-2 xl:grid-cols-3" height="h-28" />
      </Section>
    </div>
  );
}

export function InfrastructureDashboard() {
  const { data, loading, error, refresh } = useInfrastructure();

  if (loading && !data) return <InfrastructureSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Updated {formatRelativeTime(data.generatedAt)}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <Section title="Telemetry sources" description="Where this data comes from and whether it is connected.">
        <SourceStatus sources={data.sources} />
      </Section>

      <Section title="Alerts">
        <InfrastructureAlerts alerts={data.alerts} />
      </Section>

      <Section title="Hardware" description="Click a card for the detailed view.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CpuCard cpu={data.cpu} />
          <MemoryCard memory={data.memory} />
          <GpuCard gpu={data.gpu} />
          <NetworkCard network={data.network} />
          <StorageSummaryCard storage={data.storage} />
          <UptimeCard uptime={data.uptime} />
        </div>
      </Section>

      <Section title="Storage" description="Capacity and health per filesystem / pool.">
        <StorageOverview pools={data.storage.pools} />
      </Section>

      <Section title="Drives" description="Drive inventory with temperature and SMART status where available.">
        <DriveInventory drives={data.storage.drives} />
      </Section>
    </div>
  );
}
