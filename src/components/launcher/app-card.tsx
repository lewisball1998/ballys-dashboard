"use client";

import { useState } from "react";
import type { AppDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  checkHealth,
  deleteApp,
  lifecycleAction,
  setFavourite,
} from "@/hooks/launcher-api";
import { AppIcon } from "./app-icon";
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
    <Card className="flex h-full flex-col gap-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-3">
        <AppIcon icon={app.icon} name={app.name} className="h-9 w-9 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{app.name}</p>
            <button
              type="button"
              aria-label={app.isFavourite ? "Unfavourite" : "Favourite"}
              disabled={busy}
              onClick={() => run(() => setFavourite(app.id, !app.isFavourite))}
              className={cn(
                "shrink-0 text-base leading-none transition-colors",
                app.isFavourite ? "text-accent" : "text-foreground/30 hover:text-muted",
              )}
            >
              {app.isFavourite ? "★" : "☆"}
            </button>
          </div>
          {app.description ? (
            <p className="mt-0.5 truncate text-xs text-muted">{app.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {app.healthEnabled ? (
          <Badge tone={healthTone(status)}>{healthLabel(status)}</Badge>
        ) : (
          <Badge tone="neutral" dot={false}>
            Health off
          </Badge>
        )}
        {app.isHidden ? (
          <Badge tone="neutral" dot={false}>
            Hidden
          </Badge>
        ) : null}
        {app.lifecycle === "retired" ? (
          <Badge tone="warning" dot={false}>
            Retired
          </Badge>
        ) : null}
        {app.latestHealth?.latencyMs != null ? (
          <span className="ml-auto text-xs tabular-nums text-muted">{app.latestHealth.latencyMs} ms</span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <a
          href={app.url}
          target={app.openNewTab ? "_blank" : undefined}
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground shadow-sm shadow-accent/20 transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
