"use client";

import type { ReactNode } from "react";
import { useInfrastructure } from "@/hooks/use-infrastructure";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
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

export function InfrastructureDashboard() {
  const { data, loading, error, refresh } = useInfrastructure();

  if (loading && !data) return <LoadingState label="Loading infrastructure telemetry…" />;
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
