"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppDTO } from "@/lib/types";
import { fetchApps } from "@/hooks/launcher-api";
import { summariseAppHealth } from "@/components/launcher/launcher-logic";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

/** Live summary of app health on the dashboard. */
export function AppHealthSummaryWidget() {
  const [apps, setApps] = useState<AppDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchApps({ lifecycle: "active", includeHidden: true });
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
  if (apps === null) return <LoadingState label="Loading app health…" />;
  if (apps.length === 0) return <EmptyState title="No apps yet" description="Add apps in the launcher." />;

  const s = summariseAppHealth(apps);
  if (s.monitored === 0) {
    return <EmptyState title="No health checks enabled" description="Enable health on an app to monitor it." />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="success">Up {s.up}</Badge>
        <Badge tone="warning">Degraded {s.degraded}</Badge>
        <Badge tone="error">Down {s.down}</Badge>
        <Badge tone="neutral">Unknown {s.unknown}</Badge>
      </div>
      <p className="text-xs text-muted">
        Monitoring {s.monitored} of {s.total} app{s.total === 1 ? "" : "s"}
      </p>
    </div>
  );
}
