"use client";

import { useState } from "react";
import type { AppDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  checkHealth,
  deleteApp,
  lifecycleAction,
  setFavourite,
} from "@/hooks/launcher-api";
import { healthLabel, healthTone } from "./launcher-logic";

interface AppCardProps {
  app: AppDTO;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (app: AppDTO) => void;
  onMove: (app: AppDTO, direction: "up" | "down") => void;
  onMutate: () => void;
}

export function AppCard({ app, isFirst, isLast, onEdit, onMove, onMutate }: AppCardProps) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onMutate();
    } finally {
      setBusy(false);
    }
  };

  const status = app.latestHealth?.status;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {app.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user icon URL; next/image would require remote config
          <img src={app.icon} alt="" className="h-9 w-9 rounded-md object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground/10 text-sm font-semibold">
            {app.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{app.name}</p>
            <button
              type="button"
              aria-label={app.isFavourite ? "Unfavourite" : "Favourite"}
              disabled={busy}
              onClick={() => run(() => setFavourite(app.id, !app.isFavourite))}
              className={app.isFavourite ? "text-accent" : "text-foreground/30 hover:text-foreground/60"}
            >
              {app.isFavourite ? "★" : "☆"}
            </button>
          </div>
          {app.description ? (
            <p className="truncate text-xs text-foreground/60">{app.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {app.healthEnabled ? (
          <Badge tone={healthTone(status)}>{healthLabel(status)}</Badge>
        ) : (
          <Badge tone="neutral">Health off</Badge>
        )}
        {app.isHidden ? <Badge tone="neutral">Hidden</Badge> : null}
        {app.lifecycle === "retired" ? <Badge tone="warning">Retired</Badge> : null}
        {app.latestHealth?.latencyMs != null ? (
          <span className="text-xs text-foreground/50">{app.latestHealth.latencyMs} ms</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={app.url}
          target={app.openNewTab ? "_blank" : undefined}
          rel="noreferrer"
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          Open
        </a>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(app)}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => checkHealth(app.id))}>
          Check now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => run(() => lifecycleAction(app.id, app.isHidden ? "unhide" : "hide"))}
        >
          {app.isHidden ? "Unhide" : "Hide"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(() => lifecycleAction(app.id, app.healthEnabled ? "disable-health" : "enable-health"))
          }
        >
          {app.healthEnabled ? "Disable health" : "Enable health"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(() => lifecycleAction(app.id, app.lifecycle === "retired" ? "restore" : "retire"))
          }
        >
          {app.lifecycle === "retired" ? "Restore" : "Retire"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || isFirst}
          aria-label="Move up"
          onClick={() => onMove(app, "up")}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || isLast}
          aria-label="Move down"
          onClick={() => onMove(app, "down")}
        >
          ↓
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete "${app.name}"? This cannot be undone.`)) run(() => deleteApp(app.id));
          }}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}
