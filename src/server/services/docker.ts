import {
  dockerRequest,
  DockerUnavailableError,
  type DockerEngineResponse,
} from "@/server/docker/engine";
import type {
  DockerAction,
  DockerActionResultDTO,
  DockerAvailabilityDTO,
  DockerContainerDTO,
  DockerContainerState,
  DockerContainersResponseDTO,
  DockerGroupDTO,
  DockerHealth,
  DockerPortDTO,
  DockerPortHostScope,
} from "@/lib/types";

/**
 * Docker Command Centre service (v0.2). Maps the Engine API into the safe DTO
 * subset and exposes the three allowed lifecycle actions (start/stop/restart).
 *
 * The pure mapping/grouping helpers are exported for unit testing and contain no
 * I/O. The orchestration functions are the only callers of the privileged engine
 * client. No image/volume/network/exec operations exist here by design.
 */

// --- Raw Engine shapes (the subset we read) ---------------------------------

interface RawPort {
  IP?: string;
  PrivatePort?: number;
  PublicPort?: number;
  Type?: string;
}

interface RawContainer {
  Id?: string;
  Names?: string[];
  Image?: string;
  Created?: number;
  Ports?: RawPort[];
  Labels?: Record<string, string>;
  State?: string;
  Status?: string;
}

const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";
const COMPOSE_SERVICE_LABEL = "com.docker.compose.service";

const KNOWN_STATES: ReadonlySet<DockerContainerState> = new Set([
  "running",
  "exited",
  "restarting",
  "paused",
  "created",
  "dead",
  "removing",
]);

// --- Pure mapping helpers (no I/O — unit tested) ----------------------------

export function normaliseState(state: string | undefined): DockerContainerState {
  const s = (state ?? "").toLowerCase();
  return KNOWN_STATES.has(s as DockerContainerState) ? (s as DockerContainerState) : "unknown";
}

/** Derive health from the daemon's status text (the list endpoint has no
 * structured Health field). "Up 3 hours (healthy)" → "healthy". */
export function parseHealth(status: string | undefined): DockerHealth {
  const s = (status ?? "").toLowerCase();
  if (s.includes("(healthy)")) return "healthy";
  if (s.includes("(unhealthy)")) return "unhealthy";
  if (s.includes("health: starting") || s.includes("(starting)")) return "starting";
  return "none";
}

function cleanName(names: string[] | undefined): string {
  const first = names?.[0] ?? "";
  return first.replace(/^\//, "") || "unnamed";
}

/** Reachability scope of a host binding (the specific IP is never surfaced).
 * `0.0.0.0`/`::`/none = all interfaces; `127.0.0.1`/`::1` = loopback only. */
function hostScopeOf(ip: string | undefined): DockerPortHostScope {
  if (!ip || ip === "0.0.0.0" || ip === "::") return "all";
  if (ip === "127.0.0.1" || ip === "::1") return "loopback";
  return "specific";
}

/** Dedupe + normalise the published ports (the Engine lists one entry per host
 * IP family, so 0.0.0.0 and :: collapse to a single logical mapping). */
function mapPorts(ports: RawPort[] | undefined): DockerPortDTO[] {
  if (!ports?.length) return [];
  const seen = new Map<string, DockerPortDTO>();
  for (const p of ports) {
    if (typeof p.PrivatePort !== "number") continue;
    const dto: DockerPortDTO = {
      privatePort: p.PrivatePort,
      publicPort: typeof p.PublicPort === "number" ? p.PublicPort : null,
      type: (p.Type ?? "tcp").toLowerCase(),
      hostScope: hostScopeOf(p.IP),
    };
    // Prefer an "all"/"specific" binding over a loopback duplicate of the same
    // mapping, so a service also bound to 0.0.0.0 isn't reported loopback-only.
    const key = `${dto.type}:${dto.privatePort}->${dto.publicPort ?? ""}`;
    const prev = seen.get(key);
    if (prev && prev.hostScope !== "loopback" && dto.hostScope === "loopback") continue;
    seen.set(key, dto);
  }
  return [...seen.values()].sort(
    (a, b) => (b.publicPort ?? 0) - (a.publicPort ?? 0) || a.privatePort - b.privatePort,
  );
}

export function mapContainer(raw: RawContainer): DockerContainerDTO {
  const id = raw.Id ?? "";
  const labels = raw.Labels ?? {};
  return {
    id,
    shortId: id.slice(0, 12),
    name: cleanName(raw.Names),
    image: raw.Image ?? "unknown",
    state: normaliseState(raw.State),
    status: raw.Status ?? "",
    health: parseHealth(raw.Status),
    ports: mapPorts(raw.Ports),
    composeProject: labels[COMPOSE_PROJECT_LABEL] ?? null,
    composeService: labels[COMPOSE_SERVICE_LABEL] ?? null,
    createdAt:
      typeof raw.Created === "number" && raw.Created > 0
        ? new Date(raw.Created * 1000).toISOString()
        : new Date(0).toISOString(),
  };
}

/** Group containers by compose project (null project last), each group sorted by
 * name, so the UI can render scannable stacks. */
export function groupByProject(containers: DockerContainerDTO[]): DockerGroupDTO[] {
  const groups = new Map<string | null, DockerContainerDTO[]>();
  for (const c of containers) {
    const key = c.composeProject;
    const bucket = groups.get(key);
    if (bucket) bucket.push(c);
    else groups.set(key, [c]);
  }
  return [...groups.entries()]
    .map(([project, items]) => ({
      project,
      containers: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.project === null) return 1; // standalone group last
      if (b.project === null) return -1;
      return a.project.localeCompare(b.project);
    });
}

export function describeUnavailable(err: DockerUnavailableError): DockerAvailabilityDTO {
  return { available: false, reason: err.reason, message: err.message };
}

// --- Orchestration (the only callers of the privileged engine) --------------

/** List + group containers, or a clear availability reason when Docker is not
 * usable. Never throws for an unreachable daemon — the UI renders the reason. */
export async function getDockerContainers(): Promise<DockerContainersResponseDTO> {
  let res: DockerEngineResponse;
  try {
    res = await dockerRequest("GET", "/containers/json?all=1");
  } catch (err) {
    if (err instanceof DockerUnavailableError) {
      return { availability: describeUnavailable(err), groups: [], total: 0 };
    }
    throw err;
  }

  if (res.status !== 200) {
    return {
      availability: {
        available: false,
        reason: res.status === 401 || res.status === 403 ? "permission_denied" : "error",
        message: `Docker API returned status ${res.status}.`,
      },
      groups: [],
      total: 0,
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(res.body);
  } catch {
    return {
      availability: { available: false, reason: "error", message: "Unexpected Docker API response." },
      groups: [],
      total: 0,
    };
  }

  const containers = Array.isArray(raw) ? raw.map((c) => mapContainer(c as RawContainer)) : [];
  return {
    availability: { available: true },
    groups: groupByProject(containers),
    total: containers.length,
  };
}

const ACTION_PATH: Record<DockerAction, (id: string) => string> = {
  start: (id) => `/containers/${id}/start`,
  stop: (id) => `/containers/${id}/stop`,
  restart: (id) => `/containers/${id}/restart`,
};

export type ContainerActionOutcome =
  | { ok: true; result: DockerActionResultDTO }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "unavailable"; availability: DockerAvailabilityDTO }
  | { ok: false; kind: "engine_error"; message: string };

/**
 * Perform a validated lifecycle action. The id is already schema-validated
 * (hex 12–64) by the route before reaching here. Engine semantics:
 *   204 — done · 304 — already in target state (no-op) · 404 — no such container
 *   · 409 — conflict (e.g. cannot stop) · other — engine error.
 */
export async function runContainerAction(
  id: string,
  action: DockerAction,
): Promise<ContainerActionOutcome> {
  let res: DockerEngineResponse;
  try {
    res = await dockerRequest("POST", ACTION_PATH[action](id));
  } catch (err) {
    if (err instanceof DockerUnavailableError) {
      return { ok: false, kind: "unavailable", availability: describeUnavailable(err) };
    }
    throw err;
  }

  if (res.status === 204) return { ok: true, result: { id, action, noop: false } };
  if (res.status === 304) return { ok: true, result: { id, action, noop: true } };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (res.status === 409) {
    return { ok: false, kind: "conflict", message: `Container is not in a state that allows ${action}.` };
  }
  return { ok: false, kind: "engine_error", message: `Docker API returned status ${res.status}.` };
}
