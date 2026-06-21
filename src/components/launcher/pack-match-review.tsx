"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppDTO, IconPackDTO, PackMatchApplyResultDTO } from "@/lib/types";
import { matchPackToApps, type MatchConfidence } from "@/lib/icons/pack-match";
import { buildPackRef, parseIconRef } from "@/lib/icons/resolve";
import { fetchApps } from "@/hooks/launcher-api";
import { applyPackMatches, fetchIconPacks } from "@/hooks/icon-packs-api";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppIcon } from "./app-icon";

/** Per-row editable state: whether to apply, and which pack icon to assign. */
interface Row {
  selected: boolean;
  overrideKey: string;
}

const CONFIDENCE_TONE: Record<MatchConfidence, BadgeTone> = {
  high: "success",
  medium: "info",
  low: "neutral",
};

interface PackMatchReviewProps {
  /** Pack to preselect (e.g. the just-imported one via `?pack=`). */
  initialPackId?: string | null;
}

export function PackMatchReview({ initialPackId }: PackMatchReviewProps) {
  const [packs, setPacks] = useState<IconPackDTO[] | null>(null);
  const [apps, setApps] = useState<AppDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [packId, setPackId] = useState<string | null>(initialPackId ?? null);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [overwriteCustomised, setOverwriteCustomised] = useState(false);

  const [rows, setRows] = useState<Record<number, Row>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [result, setResult] = useState<PackMatchApplyResultDTO | null>(null);

  const loadApps = useCallback(async () => {
    const res = await fetchApps({
      lifecycle: includeHidden ? "all" : "active",
      includeHidden,
    });
    if (res.ok) setApps(res.data.items);
    else setLoadError(res.error.message);
  }, [includeHidden]);

  // Initial: load packs once, then settle the selected pack.
  useEffect(() => {
    void (async () => {
      const res = await fetchIconPacks();
      if (!res.ok) {
        setLoadError(res.error.message);
        setPacks([]);
        return;
      }
      setPacks(res.data.items);
      setPackId((prev) => {
        if (prev && res.data.items.some((p) => p.id === prev)) return prev;
        return res.data.items[0]?.id ?? null;
      });
    })();
  }, []);

  // Reload apps whenever the hidden/retired scope changes.
  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const pack = useMemo(() => packs?.find((p) => p.id === packId) ?? null, [packs, packId]);

  const suggestions = useMemo(() => (pack ? matchPackToApps(apps, pack) : []), [apps, pack]);

  // (Re)seed editable rows from the suggestions for the current pack/app set.
  useEffect(() => {
    const next: Record<number, Row> = {};
    for (const s of suggestions)
      next[s.appId] = { selected: s.defaultSelected, overrideKey: s.iconKey };
    setRows(next);
    setResult(null);
    setApplyError(null);
  }, [suggestions]);

  // Derived per-row flags given the live override + overwrite toggle.
  const rowInfo = (appId: number, currentIcon: string | null) => {
    const row = rows[appId];
    const overrideKey = row?.overrideKey ?? "";
    const targetRef = pack && overrideKey ? buildPackRef(pack.id, overrideKey) : "";
    const cur = (currentIcon ?? "").trim();
    const hasIcon = parseIconRef(cur).kind !== "none";
    const alreadySet = targetRef !== "" && cur === targetRef;
    const isProtected = hasIcon && !alreadySet;
    const canApply = targetRef !== "" && !alreadySet && (!isProtected || overwriteCustomised);
    return {
      overrideKey,
      targetRef,
      alreadySet,
      isProtected,
      canApply,
      selected: row?.selected ?? false,
    };
  };

  const assignments = useMemo(() => {
    return suggestions
      .map((s) => {
        const info = rowInfo(s.appId, s.currentIcon);
        return info.canApply && info.selected
          ? { appId: s.appId, iconKey: info.overrideKey }
          : null;
      })
      .filter((x): x is { appId: number; iconKey: string } => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, rows, overwriteCustomised, pack]);

  const setSelected = (appId: number, selected: boolean) =>
    setRows((prev) => ({ ...prev, [appId]: { ...prev[appId]!, selected } }));

  const setOverride = (appId: number, overrideKey: string) =>
    setRows((prev) => ({ ...prev, [appId]: { ...prev[appId]!, overrideKey } }));

  const setAll = (selected: boolean) =>
    setRows((prev) => {
      const next: Record<number, Row> = {};
      for (const [id, row] of Object.entries(prev)) next[Number(id)] = { ...row, selected };
      return next;
    });

  const doApply = async () => {
    if (!pack || assignments.length === 0) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setApplyError(null);
    const res = await applyPackMatches(pack.id, { assignments, overwriteCustomised });
    setSubmitting(false);
    if (res.ok) {
      setResult(res.data);
      void loadApps(); // reflect the new icons if the user returns to review
    } else {
      setApplyError(res.error.message);
    }
  };

  // --- Loading / error / empty ----------------------------------------------

  if (packs === null) return <LoadingState label="Loading packs and apps…" />;
  if (loadError && apps.length === 0 && packs.length === 0)
    return <ErrorState message={loadError} onRetry={() => void loadApps()} />;

  if (packs.length === 0) {
    return (
      <EmptyState
        title="No icon packs imported yet"
        description="Import a .zip icon pack from an app's icon picker (Packs tab), then come back here to match its icons to your apps."
      >
        <Link href="/apps">
          <Button size="sm">Back to Apps</Button>
        </Link>
      </EmptyState>
    );
  }

  // --- Result ----------------------------------------------------------------

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{result.applied} applied</Badge>
          <Badge tone={result.skipped ? "info" : "neutral"}>{result.skipped} skipped</Badge>
          <Badge tone={result.failed ? "error" : "neutral"}>{result.failed} failed</Badge>
        </div>
        <Card>
          <ul className="divide-border divide-y text-sm">
            {result.outcomes.map((o) => (
              <li key={o.appId} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{o.name || `App #${o.appId}`}</span>
                <span className="text-muted shrink-0 text-xs">
                  {o.status === "applied"
                    ? "Applied"
                    : o.status === "skipped"
                      ? `Skipped — ${o.message ?? "no change"}`
                      : `Failed — ${o.message ?? "error"}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setResult(null)}>
            Back to review
          </Button>
          <Link href="/apps">
            <Button size="sm">Go to Apps</Button>
          </Link>
        </div>
      </div>
    );
  }

  // --- Review ----------------------------------------------------------------

  const applicable = assignments.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <label className="text-muted mb-1 block text-xs font-medium" htmlFor="pack-select">
            Icon pack
          </label>
          <Select
            id="pack-select"
            value={packId ?? ""}
            onChange={(e) => setPackId(e.target.value)}
            className="h-9 w-auto min-w-56"
          >
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.iconCount} icon{p.iconCount === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => setIncludeHidden(e.target.checked)}
            />
            Include hidden/retired
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overwriteCustomised}
              onChange={(e) => setOverwriteCustomised(e.target.checked)}
            />
            Replace existing icons
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-sm">
          {applicable} of {suggestions.length} match{suggestions.length === 1 ? "" : "es"} selected.
          Nothing changes until you confirm. Apps with an existing icon are protected unless you
          enable “Replace existing icons”.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
            Select all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAll(false)}
            disabled={applicable === 0}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={applicable === 0 || submitting}
          >
            {submitting ? "Applying…" : `Apply ${applicable > 0 ? `(${applicable})` : ""}`}
          </Button>
        </div>
      </div>

      {applyError ? <p className="text-sm text-rose-600 dark:text-rose-400">{applyError}</p> : null}

      {suggestions.length === 0 ? (
        <EmptyState
          title="No suggested matches"
          description="None of your apps clearly match this pack's icons by name or URL. You can still pick icons manually from an app's icon picker (Packs tab)."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-border divide-y">
            {suggestions.map((s) => {
              const info = rowInfo(s.appId, s.currentIcon);
              return (
                <li key={s.appId} className="flex flex-wrap items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    aria-label={`Apply icon to ${s.appName}`}
                    checked={info.canApply && info.selected}
                    disabled={!info.canApply}
                    onChange={(e) => setSelected(s.appId, e.target.checked)}
                  />

                  <div className="min-w-40 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">{s.appName}</p>
                    <p className="text-muted truncate text-xs">{s.appUrl}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <AppIcon icon={s.currentIcon} name={s.appName} className="h-8 w-8" />
                      <span className="text-muted text-[10px]">Current</span>
                    </div>
                    <span className="text-muted" aria-hidden>
                      →
                    </span>
                    <div className="flex flex-col items-center gap-0.5">
                      <AppIcon
                        icon={info.targetRef || null}
                        name={s.iconLabel}
                        className="h-8 w-8"
                      />
                      <span className="text-muted text-[10px]">Proposed</span>
                    </div>
                  </div>

                  <div className="min-w-44 flex-1">
                    <Select
                      aria-label={`Icon for ${s.appName}`}
                      value={info.overrideKey}
                      onChange={(e) => setOverride(s.appId, e.target.value)}
                      className="h-9"
                    >
                      {pack?.icons.map((icon) => (
                        <option key={icon.key} value={icon.key}>
                          {icon.label ?? icon.key}
                        </option>
                      ))}
                    </Select>
                    <p className="text-muted mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge tone={CONFIDENCE_TONE[s.confidence]} dot={false}>
                        {s.confidence}
                      </Badge>
                      {info.alreadySet ? (
                        <Badge tone="neutral" dot={false}>
                          Already set
                        </Badge>
                      ) : info.isProtected ? (
                        <Badge tone="warning" dot={false}>
                          {overwriteCustomised ? "Will replace icon" : "Has custom icon"}
                        </Badge>
                      ) : null}
                      <span className="truncate">{s.reason}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Apply ${applicable} icon${applicable === 1 ? "" : "s"}?`}
        description={
          overwriteCustomised
            ? "Selected apps will have their icon set to the chosen pack icon — including apps that already had a custom icon. This cannot be undone in bulk."
            : "Selected apps will have their icon set to the chosen pack icon. Apps with an existing icon are skipped."
        }
        confirmLabel="Apply"
        onConfirm={() => void doApply()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
