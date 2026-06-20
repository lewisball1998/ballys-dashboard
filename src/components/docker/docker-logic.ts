import type { BadgeTone } from "@/components/ui/badge";
import type {
  DockerContainerState,
  DockerHealth,
  DockerPortDTO,
  DockerUnavailableReason,
} from "@/lib/types";

/** Presentation logic for the Docker Command Centre. Pure + unit-testable. */

const STATE_META: Record<DockerContainerState, { tone: BadgeTone; label: string }> = {
  running: { tone: "success", label: "Running" },
  restarting: { tone: "warning", label: "Restarting" },
  paused: { tone: "info", label: "Paused" },
  created: { tone: "neutral", label: "Created" },
  exited: { tone: "neutral", label: "Exited" },
  removing: { tone: "warning", label: "Removing" },
  dead: { tone: "error", label: "Dead" },
  unknown: { tone: "neutral", label: "Unknown" },
};

export function stateMeta(state: DockerContainerState): { tone: BadgeTone; label: string } {
  return STATE_META[state] ?? STATE_META.unknown;
}

const HEALTH_META: Record<
  Exclude<DockerHealth, "none">,
  { tone: BadgeTone; label: string }
> = {
  healthy: { tone: "success", label: "Healthy" },
  unhealthy: { tone: "error", label: "Unhealthy" },
  starting: { tone: "warning", label: "Health: starting" },
};

/** Health badge meta, or null when the container defines no healthcheck. */
export function healthMeta(health: DockerHealth): { tone: BadgeTone; label: string } | null {
  return health === "none" ? null : HEALTH_META[health];
}

/** "8080→80/tcp" when published, "80/tcp" when internal-only. */
export function formatPort(port: DockerPortDTO): string {
  const base = `${port.privatePort}/${port.type}`;
  return port.publicPort != null ? `${port.publicPort}→${base}` : base;
}

/** Compact "created N ago" string; "—" when the time is unknown. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return "—";
  const secs = Math.max(0, Math.floor((now - t) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Copy for each unavailable reason (description is a fallback; the server
 * message is shown as a secondary detail by the component). */
export function unavailableCopy(reason: DockerUnavailableReason): {
  title: string;
  description: string;
} {
  switch (reason) {
    case "not_configured":
      return {
        title: "Docker access not configured",
        description:
          "Mount the Docker socket into the dashboard container to view and manage containers. This is an opt-in, privileged step — see the setup guide.",
      };
    case "permission_denied":
      return {
        title: "Permission denied",
        description:
          "The Docker socket is reachable but the dashboard isn't allowed to use it. Grant the container access to the docker group (see the setup guide).",
      };
    case "unreachable":
      return {
        title: "Docker daemon unreachable",
        description:
          "The socket is configured but the Docker daemon didn't respond. Check that Docker is running on the host.",
      };
    case "error":
      return {
        title: "Docker error",
        description: "Something went wrong talking to the Docker daemon.",
      };
  }
}

/** Disruptive actions require an explicit confirm; start does not. */
export function isDisruptiveAction(action: "start" | "stop" | "restart"): boolean {
  return action === "stop" || action === "restart";
}
