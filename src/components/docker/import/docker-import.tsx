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
import type { AppFieldErrors, AppFormValues } from "@/components/launcher/launcher-logic";
import { CandidateCard } from "./candidate-card";
import {
  buildRows,
  selectedIds,
  validateRow,
  type ImportRow,
} from "./import-logic";

type Phase = "select" | "confirm" | "result";

export function DockerImport() {
  const { data, categories, loading, error, refresh } = useDockerImport();

  const [rows, setRows] = useState<Record<string, ImportRow>>({});
  const [phase, setPhase] = useState<Phase>("select");
  const [rowErrors, setRowErrors] = useState<Record<string, AppFieldErrors>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<DockerImportResultDTO | null>(null);

  // (Re)seed editable rows whenever the candidate list loads/refreshes. Nothing
  // is selected by default.
  useEffect(() => {
    if (data?.availability.available) {
      setRows(buildRows(data.candidates));
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

  const setField = <K extends keyof AppFormValues>(id: string, key: K, value: AppFormValues[K]) =>
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, values: { ...prev[id]!.values, [key]: value } },
    }));

  const selectAll = () =>
    setRows((prev) => {
      const next: Record<string, ImportRow> = {};
      for (const [id, row] of Object.entries(prev)) next[id] = { ...row, selected: true };
      return next;
    });

  const clearAll = () =>
    setRows((prev) => {
      const next: Record<string, ImportRow> = {};
      for (const [id, row] of Object.entries(prev)) next[id] = { ...row, selected: false };
      return next;
    });

  const goToConfirm = () => {
    // Validate every selected row first; surface inline errors and stay put.
    const errors: Record<string, AppFieldErrors> = {};
    for (const id of chosenIds) {
      const res = validateRow(id, rows[id]!.values);
      if (!res.success) errors[id] = res.fieldErrors;
    }
    setRowErrors(errors);
    if (Object.keys(errors).length === 0) setPhase("confirm");
  };

  const doImport = async () => {
    // Rows were validated on the way into the confirm phase; re-derive the
    // payload items, dropping any that no longer validate.
    const payloadItems = chosenIds
      .map((id) => {
        const res = validateRow(id, rows[id]!.values);
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
          <Link href="/apps">
            <Button variant="ghost" size="sm">
              Back to Apps
            </Button>
          </Link>
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
          <Link href="/apps">
            <Button size="sm">Go to Apps</Button>
          </Link>
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
              const v = rows[id]!.values;
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted">{v.url}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.isFavourite ? <Badge tone="info" dot={false}>Favourite</Badge> : null}
                    {v.healthEnabled ? <Badge tone="neutral" dot={false}>Health</Badge> : null}
                    {candidatesById.get(id)?.alreadyImported ? (
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
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={chosenIds.length === 0}>
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
