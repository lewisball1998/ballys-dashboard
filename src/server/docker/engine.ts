import http from "node:http";
import { env } from "@/lib/env";
import type { DockerUnavailableReason } from "@/lib/types";

/**
 * Minimal Docker Engine API client over the unix socket (SERVER-ONLY).
 *
 * Deliberately dependency-free: it speaks the Engine REST API directly via
 * Node's built-in http client (`socketPath`), so there is no shell execution and
 * no third-party Docker library. Only imported by the Docker service, which is
 * only imported by route handlers — it must never reach the client bundle.
 *
 * The socket grants root-equivalent control of the host, so this module is the
 * single choke point: callers can only issue the specific requests the service
 * builds. See ADR 0008 + docs/DOCKER.md.
 */

const DEFAULT_TIMEOUT_MS = 8_000;

export interface DockerEngineResponse {
  status: number;
  body: string;
}

/** Thrown when the daemon cannot be reached / used at all (vs. a per-request
 * 4xx/5xx, which is returned as a normal response for the caller to interpret). */
export class DockerUnavailableError extends Error {
  constructor(
    readonly reason: DockerUnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = "DockerUnavailableError";
  }
}

function classifyError(err: NodeJS.ErrnoException): DockerUnavailableError {
  switch (err.code) {
    case "ENOENT":
      return new DockerUnavailableError(
        "not_configured",
        "Docker socket not found. Mount the Docker socket to enable container management.",
      );
    case "EACCES":
    case "EPERM":
      return new DockerUnavailableError(
        "permission_denied",
        "Permission denied accessing the Docker socket.",
      );
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "ETIMEDOUT":
      return new DockerUnavailableError("unreachable", "Could not reach the Docker daemon.");
    default:
      return new DockerUnavailableError(
        "unreachable",
        "Could not reach the Docker daemon.",
      );
  }
}

/**
 * Issue a single request to the Docker Engine API over the configured unix
 * socket. Resolves with the raw status + body (including 4xx/5xx). Rejects with
 * a {@link DockerUnavailableError} only when the daemon itself is unreachable.
 *
 * `path` is always constructed server-side from a fixed template + a validated
 * container id — never from raw client input.
 */
export function dockerRequest(
  method: "GET" | "POST",
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DockerEngineResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: env.DOCKER_SOCKET_PATH,
        method,
        path,
        // The Host header is required by the Engine API but unused for unix
        // sockets; a fixed value avoids leaking anything host-specific.
        headers: { Host: "docker", Accept: "application/json" },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new DockerUnavailableError("unreachable", "Docker daemon request timed out."));
    });

    req.on("error", (err) => {
      reject(
        err instanceof DockerUnavailableError ? err : classifyError(err as NodeJS.ErrnoException),
      );
    });

    req.end();
  });
}

/** Lightweight connectivity probe (`GET /_ping`). */
export async function dockerPing(): Promise<void> {
  const res = await dockerRequest("GET", "/_ping", 4_000);
  if (res.status !== 200) {
    throw new DockerUnavailableError("unreachable", "Docker daemon did not respond to ping.");
  }
}
