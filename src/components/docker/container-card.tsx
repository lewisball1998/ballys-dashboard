"use client";

import { useState } from "react";
import type { DockerAction, DockerContainerDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatPort,
  formatRelativeTime,
  healthMeta,
  isDisruptiveAction,
  stateMeta,
} from "./docker-logic";

interface ContainerCardProps {
  container: DockerContainerDTO;
  onAction: (id: string, action: DockerAction) => Promise<{ ok: boolean; message?: string }>;
}

const MAX_PORT_CHIPS = 4;

export function ContainerCard({ container, onAction }: ContainerCardProps) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<DockerAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = stateMeta(container.state);
  const health = healthMeta(container.health);

  const isRunning =
    container.state === "running" ||
    container.state === "restarting" ||
    container.state === "paused";
  const canStart = container.state === "exited" || container.state === "created" || container.state === "dead";

  const request = (action: DockerAction) => {
    setError(null);
    if (isDisruptiveAction(action)) {
      setPending(action);
    } else {
      void perform(action);
    }
  };

  const perform = async (action: DockerAction) => {
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      const res = await onAction(container.id, action);
      if (!res.ok) setError(res.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const visiblePorts = container.ports.slice(0, MAX_PORT_CHIPS);
  const extraPorts = container.ports.length - visiblePorts.length;

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={container.name}>
            {container.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted" title={container.image}>
            {container.image}
          </p>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {health ? <Badge tone={health.tone}>{health.label}</Badge> : null}
        {container.composeService ? (
          <Badge tone="neutral" dot={false}>
            {container.composeService}
          </Badge>
        ) : null}
        {visiblePorts.map((port) => (
          <span
            key={`${port.type}:${port.privatePort}:${port.publicPort ?? "x"}`}
            className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-muted"
          >
            {formatPort(port)}
          </span>
        ))}
        {extraPorts > 0 ? (
          <span className="text-[11px] text-muted">+{extraPorts} more</span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="mr-auto truncate text-xs text-muted" title={container.status}>
          {container.status || `Created ${formatRelativeTime(container.createdAt)}`}
        </span>

        {pending ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {pending === "stop" ? "Stop" : "Restart"} this container?
            </span>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void perform(pending)}>
              Confirm
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            {canStart ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => request("start")}>
                Start
              </Button>
            ) : null}
            {isRunning ? (
              <>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => request("restart")}>
                  Restart
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => request("stop")}>
                  Stop
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
