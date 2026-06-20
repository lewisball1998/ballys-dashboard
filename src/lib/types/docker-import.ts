/**
 * Import-from-Docker DTOs (v0.2.1). Builds on the v0.2.0 Docker Command Centre:
 * the server turns the safe {@link DockerContainerDTO} subset into *import
 * candidates* — read-only hints plus server-computed suggestions — that the user
 * selectively turns into launcher Apps. Like all Docker DTOs these are a strict
 * subset; no host internals (socket path, mounts, env, command, host paths) are
 * ever surfaced. See docs/DOCKER.md and ADR 0008.
 */
import type {
  DockerAvailabilityDTO,
  DockerContainerState,
  DockerHealth,
  DockerPortDTO,
} from "./docker";

export interface DockerImportCandidateDTO {
  /**
   * Container id (validated hex). Used as a stable client key and echoed back in
   * import results. It is NOT persisted on the created app (no schema change in
   * v0.2.1), so it cannot link an app back to its container across sessions.
   */
  containerId: string;
  shortId: string;
  containerName: string;
  image: string;
  state: DockerContainerState;
  health: DockerHealth;
  ports: DockerPortDTO[];
  composeProject: string | null;
  composeService: string | null;
  /** Suggested launcher app name (user-editable — just a suggestion). */
  suggestedName: string;
  /**
   * Suggested URL derived from a published port, or null when no clear port
   * exists. A best-effort guess (uses `localhost`); the user is expected to edit
   * it, e.g. to a reverse-proxy URL like https://plex.example.com.
   */
  suggestedUrl: string | null;
  /**
   * Heuristic: the container looks like a database / sidecar / infrastructure
   * service (by image or name). Never hides the candidate — it is only a hint.
   */
  likelyInternal: boolean;
  /** Short human reason for {@link likelyInternal}, when flagged. */
  internalReason: string | null;
  /**
   * An existing app already matches this candidate's suggested name or URL, so
   * importing it as-is would likely duplicate. Only a hint; the server re-checks
   * authoritatively at import time.
   */
  alreadyImported: boolean;
  duplicateReason: string | null;
}

export interface DockerImportCandidatesResponseDTO {
  availability: DockerAvailabilityDTO;
  candidates: DockerImportCandidateDTO[];
  total: number;
}

/** Per-item outcome of an import request. */
export type DockerImportOutcomeStatus = "imported" | "skipped_duplicate" | "failed";

export interface DockerImportOutcomeDTO {
  /** Echoes the source container id from the request. */
  containerId: string;
  name: string;
  status: DockerImportOutcomeStatus;
  /** The created app id, when `status === "imported"`. */
  appId: number | null;
  /** Reason for a skip/failure, when applicable. */
  message: string | null;
}

export interface DockerImportResultDTO {
  imported: number;
  skipped: number;
  failed: number;
  outcomes: DockerImportOutcomeDTO[];
}
