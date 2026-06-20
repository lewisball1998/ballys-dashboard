import type {
  DockerContainerDTO,
  DockerImportCandidateDTO,
  DockerImportCandidatesResponseDTO,
  DockerImportOutcomeDTO,
  DockerImportResultDTO,
  DockerPortDTO,
} from "@/lib/types";
import type { DockerImportInput, DockerImportItemInput } from "@/lib/validation";
import { getDockerContainers } from "./docker";
import { createApp, listApps } from "./apps";

/**
 * Import-from-Docker service (v0.2.1). Turns the safe v0.2.0 container DTOs into
 * selectable import candidates and creates launcher Apps from the user's vetted
 * selection.
 *
 * This service ONLY reads Docker metadata (via the existing Command Centre
 * service) and creates app rows. It adds no Docker lifecycle/exec/image/volume/
 * network capability, and changes no DB schema. Pure helpers are exported for
 * unit testing and contain no I/O.
 */

// --- Pure helpers (no I/O — unit tested) ------------------------------------

/** Tidy a docker/compose identifier into a human app name ("gym-tracker" →
 * "Gym Tracker"). Best-effort; the user can always edit it. */
export function prettifyName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^\//, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return raw.trim() || "App";
  return cleaned
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Suggested app name: prefer the compose service, else the container name. */
export function suggestAppName(container: DockerContainerDTO): string {
  return prettifyName(container.composeService || container.name);
}

/**
 * Suggest a URL from the published ports, or null when none is published. Prefers
 * well-known web ports; uses `localhost` as a placeholder host the user edits.
 * This is explicitly a guess — never assumed correct (see docs/DOCKER.md).
 */
export function suggestUrlFromPorts(ports: DockerPortDTO[]): string | null {
  const published = ports.filter(
    (p): p is DockerPortDTO & { publicPort: number } => p.publicPort != null,
  );
  if (published.length === 0) return null;

  const priority = (pub: number): number => {
    if (pub === 443) return 0;
    if (pub === 80) return 1;
    if (pub === 8080 || pub === 8443) return 2;
    return 3;
  };
  const best = [...published].sort(
    (a, b) => priority(a.publicPort) - priority(b.publicPort) || a.publicPort - b.publicPort,
  )[0]!;

  const pub = best.publicPort;
  if (pub === 443) return "https://localhost";
  if (pub === 8443) return `https://localhost:${pub}`;
  return `http://localhost:${pub}`;
}

// Image/name fragments that usually indicate a backing service rather than
// something a user opens in a browser. Matched as substrings (case-insensitive).
const INTERNAL_IMAGE_HINTS = [
  "postgres", "mysql", "mariadb", "mongo", "redis", "valkey", "memcached", "rabbitmq",
  "elasticsearch", "opensearch", "clickhouse", "influxdb", "timescale", "cockroach",
  "etcd", "consul", "vault", "minio", "nats", "kafka", "zookeeper", "watchtower",
  "socket-proxy", "dockerproxy", "docker-socket-proxy",
];
const INTERNAL_NAME_HINTS = [
  "db", "database", "redis", "postgres", "mysql", "mariadb", "mongo", "cache",
  "worker", "queue", "broker", "cron", "scheduler", "backup", "sidecar", "init", "migrat",
];

function imageBase(image: string): string {
  // strip registry/host + tag/digest → bare image name
  const noTag = image.split("@")[0]!.split(":")[0]!;
  const parts = noTag.split("/");
  return (parts[parts.length - 1] ?? noTag).toLowerCase();
}

function hasWordHint(haystack: string, hints: string[]): string | null {
  const tokens = haystack.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const hint of hints) {
    if (tokens.includes(hint) || haystack.toLowerCase().includes(hint)) return hint;
  }
  return null;
}

/** Heuristic "likely an internal/helper service" hint. Never hides anything. */
export function internalHint(container: DockerContainerDTO): {
  likelyInternal: boolean;
  reason: string | null;
} {
  const base = imageBase(container.image);
  if (INTERNAL_IMAGE_HINTS.some((h) => base.includes(h))) {
    return { likelyInternal: true, reason: "Looks like a database or infrastructure image" };
  }
  const nameHaystack = `${container.name} ${container.composeService ?? ""}`;
  if (hasWordHint(nameHaystack, INTERNAL_NAME_HINTS)) {
    return { likelyInternal: true, reason: "Name suggests an internal/helper service" };
  }
  return { likelyInternal: false, reason: null };
}

/** Normalised URL for duplicate comparison (lowercased, trailing slashes off). */
export function normalizeUrlForCompare(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

/** Normalised name for duplicate comparison (lowercased, collapsed spaces). */
export function normalizeNameForCompare(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface ExistingAppIndex {
  names: Set<string>;
  urls: Set<string>;
}

export function indexExistingApps(apps: { name: string; url: string }[]): ExistingAppIndex {
  const names = new Set<string>();
  const urls = new Set<string>();
  for (const a of apps) {
    names.add(normalizeNameForCompare(a.name));
    urls.add(normalizeUrlForCompare(a.url));
  }
  return { names, urls };
}

/** Duplicate reason against the existing index, or null when unique. */
export function findDuplicate(
  name: string,
  url: string | null,
  index: ExistingAppIndex,
): string | null {
  if (url && index.urls.has(normalizeUrlForCompare(url))) {
    return "An app with this URL already exists";
  }
  if (index.names.has(normalizeNameForCompare(name))) {
    return "An app with this name already exists";
  }
  return null;
}

/** Map one container DTO to an import candidate (pure). */
export function buildCandidate(
  container: DockerContainerDTO,
  index: ExistingAppIndex,
): DockerImportCandidateDTO {
  const suggestedName = suggestAppName(container);
  const suggestedUrl = suggestUrlFromPorts(container.ports);
  const internal = internalHint(container);
  const duplicateReason = findDuplicate(suggestedName, suggestedUrl, index);

  return {
    containerId: container.id,
    shortId: container.shortId,
    containerName: container.name,
    image: container.image,
    state: container.state,
    health: container.health,
    ports: container.ports,
    composeProject: container.composeProject,
    composeService: container.composeService,
    suggestedName,
    suggestedUrl,
    likelyInternal: internal.likelyInternal,
    internalReason: internal.reason,
    alreadyImported: duplicateReason !== null,
    duplicateReason,
  };
}

// --- Orchestration (reads via the existing Docker service) -------------------

/**
 * Build the import candidate list. Reuses the v0.2.0 Command Centre read path,
 * so when Docker is not configured/reachable the `availability` reason is passed
 * straight through and the UI renders the same clear unavailable states.
 */
export async function getImportCandidates(): Promise<DockerImportCandidatesResponseDTO> {
  const containers = await getDockerContainers();
  if (!containers.availability.available) {
    return { availability: containers.availability, candidates: [], total: 0 };
  }

  const existing = listApps({ lifecycle: "all", includeHidden: true });
  const index = indexExistingApps(existing);

  const candidates = containers.groups
    .flatMap((g) => g.containers)
    .map((c) => buildCandidate(c, index));

  return { availability: { available: true }, candidates, total: candidates.length };
}

/**
 * Create launcher apps from the user's vetted selection. Each item is already
 * schema-validated by the route. Duplicates (by URL or name, vs. existing apps
 * AND earlier items in the same batch) are skipped — never silently merged or
 * duplicated. A per-item summary is returned so the UI can report exactly what
 * happened.
 */
export function importApps(input: DockerImportInput): DockerImportResultDTO {
  const existing = listApps({ lifecycle: "all", includeHidden: true });
  const index = indexExistingApps(existing);

  const outcomes: DockerImportOutcomeDTO[] = [];

  for (const item of input.items) {
    const dup = findDuplicate(item.name, item.url, index);
    if (dup) {
      outcomes.push({
        containerId: item.containerId,
        name: item.name,
        status: "skipped_duplicate",
        appId: null,
        message: dup,
      });
      continue;
    }

    try {
      const app = createAppFromItem(item);
      // Add to the index so a later item in the same batch can't duplicate it.
      index.names.add(normalizeNameForCompare(item.name));
      index.urls.add(normalizeUrlForCompare(item.url));
      outcomes.push({
        containerId: item.containerId,
        name: app.name,
        status: "imported",
        appId: app.id,
        message: null,
      });
    } catch (err) {
      outcomes.push({
        containerId: item.containerId,
        name: item.name,
        status: "failed",
        appId: null,
        message: err instanceof Error ? err.message : "Failed to create app",
      });
    }
  }

  return {
    imported: outcomes.filter((o) => o.status === "imported").length,
    skipped: outcomes.filter((o) => o.status === "skipped_duplicate").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    outcomes,
  };
}

/** Strip the import-only `containerId` before delegating to the shared app
 * creation path (which preserves health diagnostics + trusted-internal TLS). */
function createAppFromItem(item: DockerImportItemInput) {
  const { containerId: _containerId, ...appInput } = item;
  void _containerId;
  return createApp(appInput);
}
