/**
 * Docker Command Centre DTOs (v0.2). Transport-safe shapes only — deliberately
 * a SUBSET of what the Docker Engine API exposes. We never surface host
 * internals (socket path, IP bindings, mounts/filesystem paths, env, full
 * command, labels beyond compose grouping) to the client. See docs/DOCKER.md
 * and ADR 0008.
 */

/** Normalised container lifecycle state (maps from the Engine `State` field). */
export type DockerContainerState =
  | "running"
  | "exited"
  | "restarting"
  | "paused"
  | "created"
  | "dead"
  | "removing"
  | "unknown";

/** Container health, where a HEALTHCHECK is defined ("none" when there isn't). */
export type DockerHealth = "healthy" | "unhealthy" | "starting" | "none";

/**
 * Host-binding scope of a port (derived; the specific host IP is intentionally
 * never surfaced). "all" = published on all interfaces (`0.0.0.0`/`::`),
 * "loopback" = `127.0.0.1`/`::1` only (reachable only from the Docker host),
 * "specific" = bound to some other host IP. Internal-only ports report "all".
 */
export type DockerPortHostScope = "all" | "loopback" | "specific";

/** A published/exposed port. The specific host IP binding is intentionally
 * omitted — only the reachability {@link DockerPortHostScope} is surfaced. */
export interface DockerPortDTO {
  privatePort: number;
  publicPort: number | null;
  /** "tcp" | "udp" | "sctp". */
  type: string;
  hostScope: DockerPortHostScope;
}

export interface DockerContainerDTO {
  /** Container id — the validated identifier used for lifecycle actions. */
  id: string;
  /** Short 12-char id for display. */
  shortId: string;
  name: string;
  image: string;
  state: DockerContainerState;
  /** Human-readable status text from the daemon, e.g. "Up 3 hours (healthy)". */
  status: string;
  health: DockerHealth;
  ports: DockerPortDTO[];
  /** Compose project label, when the container is part of a compose stack. */
  composeProject: string | null;
  /** Compose service label, when present. */
  composeService: string | null;
  /** Creation time (ISO 8601, UTC). */
  createdAt: string;
}

/** Containers grouped by compose project (null project = standalone). */
export interface DockerGroupDTO {
  project: string | null;
  containers: DockerContainerDTO[];
}

/** Why Docker is not usable, when it isn't. */
export type DockerUnavailableReason =
  | "not_configured"
  | "permission_denied"
  | "unreachable"
  | "error";

export type DockerAvailabilityDTO =
  | { available: true }
  | { available: false; reason: DockerUnavailableReason; message: string };

export interface DockerContainersResponseDTO {
  availability: DockerAvailabilityDTO;
  groups: DockerGroupDTO[];
  total: number;
}

/** The disruptive-but-safe lifecycle actions exposed by the Command Centre. */
export const DOCKER_ACTIONS = ["start", "stop", "restart"] as const;
export type DockerAction = (typeof DOCKER_ACTIONS)[number];

export interface DockerActionResultDTO {
  id: string;
  action: DockerAction;
  /** `true` when the daemon reports the container was already in the target
   * state (Engine 304) — treated as a successful no-op. */
  noop: boolean;
}
