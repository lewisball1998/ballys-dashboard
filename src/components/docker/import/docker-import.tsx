"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DockerImportCandidateDTO, DockerImportResultDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDockerImport } from "@/hooks/use-docker-import";
import { importApps } from "@/hooks/docker-import-api";
import { unavailableCopy } from "@/components/docker/docker-logic";
import { CandidateCard } from "./candidate-card";
import {
  appUrl,
  buildRows,
  selectedIds,
  validateRow,
  type ImportFieldErrors,
  type ImportRow,
  type ImportRowValues,
} from "./import-logic";

type Phase = "select" | "confirm" | "result";

interface DockerImportProps {
  /** When embedded (e.g. in the setup wizard) the "go to Apps" navigation links
   * are hidden so the user stays in the surrounding flow. */
  embedded?: boolean;
}

/** The dashboard's own hostname is the best default for the Docker host/base —
 * it's whatever the user typed to reach the dashboard (their NAS/server). */
function defaultHostBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

export function DockerImport({ embedded = false }: DockerImportProps) {
  const { data, categories, loading, error, refresh } = useDockerImport();

  const [rows, setRows] = useState<Record<string, ImportRow>>({});
  const [phase, setPhase] = useState<Phase>("select");
  const [rowErrors, setRowErrors] = useState<Record<string, ImportFieldErrors>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<DockerImportResultDTO | null>(null);

  // (Re)seed editable rows whenever the candidate list loads/refreshes. Nothing
  // is selected by default; the host/base defaults to the dashboard hostname.
  useEffect(() => {
    if (data?.availability.available) {
      setRows(buildRows(data.candidates, defaultHostBase()));
      setPhase("select");
      setRowErrors({});
      setResult(null);
    }
  }, [data]);

  const candidatesById = useMemo(() => {
    const map = new Map<string, DockerImportCandidateDTO>();
    for (const c of data?.candidates ?? []) map.set(c.containerId, c);
    return map;
  }, [data]);

  const chosenIds = selectedIds(rows);

  const setSelected = (id: string, selected: boolean) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id]!, selected } }));

  const setField = <K extends keyof ImportRowValues>(id: string, key: K, value: ImportRowValues[K]) =>
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, values: { ...prev[id]!.values, [key]: value } },
    }));

  const setAllSelected = (selected: boolean) =>
    setRows((prev) => {
      const next: Record<string, ImportRow> = {};
      for (const [id, row] of Object.entries(prev)) next[id] = { ...row, selected };
      return next;
    });

  const goToConfirm = () => {
    const errors: Record<string, ImportFieldErrors> = {};
    for (const id of chosenIds) {
      const candidate = candidatesById.get(id);
      if (!candidate) continue;
      const res = validateRow(candidate, rows[id]!.values);
      if (!res.success) errors[id] = res.fieldErrors;
    }
    setRowErrors(errors);
    if (Object.keys(errors).length === 0) setPhase("confirm");
  };

  const doImport = async () => {
    const payloadItems = chosenIds
      .map((id) => {
        const candidate = candidatesById.get(id);
        if (!candidate) return null;
        const res = validateRow(candidate, rows[id]!.values);
        return res.success ? res.item : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    setSubmitting(true);
    setImportError(null);
    const res = await importApps({ items: payloadItems });
    setSubmitting(false);
    if (res.ok) {
      setResult(res.data);
      setPhase("result");
    } else {
      setImportError(res.error.message);
    }
  };

  // --- Loading / transport error / unavailable / empty -----------------------

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
          <p className="max-w-prose text-xs text-muted/80">
            Importing from Docker needs Docker access enabled — see <code>docs/DOCKER.md</code> for
            the (opt-in, privileged) setup. You can still add apps manually.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
          {!embedded ? (
            <Link href="/apps">
              <Button variant="ghost" size="sm">
                Back to Apps
              </Button>
            </Link>
          ) : null}
        </div>
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <EmptyState
        title="No containers found"
        description="Docker is connected, but there are no containers to import yet."
      >
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </EmptyState>
    );
  }

  // --- Result phase ----------------------------------------------------------

  if (phase === "result" && result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{result.imported} imported</Badge>
          <Badge tone={result.skipped ? "info" : "neutral"}>{result.skipped} skipped (duplicate)</Badge>
          <Badge tone={result.failed ? "error" : "neutral"}>{result.failed} failed</Badge>
        </div>
        <Card>
          <ul className="divide-y divide-border text-sm">
            {result.outcomes.map((o) => (
              <li key={o.containerId} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{o.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {o.status === "imported"
                    ? "Imported"
                    : o.status === "skipped_duplicate"
                      ? `Skipped — ${o.message ?? "duplicate"}`
                      : `Failed — ${o.message ?? "error"}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex gap-2">
          {!embedded ? (
            <Link href="/apps">
              <Button size="sm">Go to Apps</Button>
            </Link>
          ) : null}
          <Button variant="outline" size="sm" onClick={refresh}>
            Import more
          </Button>
        </div>
      </div>
    );
  }

  // --- Confirm phase ---------------------------------------------------------

  if (phase === "confirm") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Review the {chosenIds.length} app{chosenIds.length === 1 ? "" : "s"} to be created. No apps
          are created until you confirm.
        </p>
        <Card>
          <ul className="divide-y divide-border text-sm">
            {chosenIds.map((id) => {
              const candidate = candidatesById.get(id);
              const v = rows[id]!.values;
              const url = candidate ? appUrl(candidate, v) : "";
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted">{url}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.isFavourite ? <Badge tone="info" dot={false}>Favourite</Badge> : null}
                    {v.healthEnabled ? <Badge tone="neutral" dot={false}>Health</Badge> : null}
                    {candidate?.alreadyImported ? (
                      <Badge tone="warning" dot={false}>May duplicate</Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        {importError ? <p className="text-sm text-rose-600 dark:text-rose-400">{importError}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPhase("select")} disabled={submitting}>
            Back
          </Button>
          <Button size="sm" onClick={doImport} disabled={submitting || chosenIds.length === 0}>
            {submitting ? "Importing…" : `Import ${chosenIds.length} app${chosenIds.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    );
  }

  // --- Select phase ----------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {chosenIds.length} of {data.total} selected. Pick the containers to add to your Apps
          launcher — nothing is imported until you confirm.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAllSelected(true)}>
            Select all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllSelected(false)}
            disabled={chosenIds.length === 0}
          >
            Clear
          </Button>
          <Button size="sm" onClick={goToConfirm} disabled={chosenIds.length === 0}>
            Review {chosenIds.length > 0 ? `(${chosenIds.length})` : ""}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.candidates.map((candidate) => {
          const row = rows[candidate.containerId];
          if (!row) return null;
          return (
            <CandidateCard
              key={candidate.containerId}
              candidate={candidate}
              row={row}
              categories={categories}
              errors={rowErrors[candidate.containerId]}
              onToggle={(selected) => setSelected(candidate.containerId, selected)}
              onChange={(key, value) => setField(candidate.containerId, key, value)}
            />
          );
        })}
      </div>
    </div>
  );
}
