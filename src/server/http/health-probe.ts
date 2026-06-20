import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { GuardedFetchError, validateRequestUrl } from "./guarded-fetch";

/**
 * Health probe — a focused, diagnostic HTTP(S) check for app health.
 *
 * Why this exists separately from `guardedFetch`: a health check needs two
 * things that the fetch-based wrapper can't give cleanly on this Node runtime:
 *
 *   1. Precise, user-friendly failure reasons. The global `fetch` collapses all
 *      network/TLS failures into "fetch failed" (the real cause is buried in
 *      `error.cause`). Using `node:http`/`node:https` directly surfaces the real
 *      `error.code` (ENOTFOUND, ECONNREFUSED, self-signed cert codes, …).
 *
 *   2. A per-request TLS escape hatch for trusted internal services (NAS/admin
 *      panels with self-signed certs) WITHOUT weakening anything else. We set
 *      `rejectUnauthorized: false` only on the single request, only when the
 *      per-app option is on. Global TLS verification is never disabled.
 *
 * URL validation (protocol allow-list, redirect re-validation) is still routed
 * through the central guarded-fetch validator so the SSRF chokepoint stays in
 * one place. Private/LAN targets are allowed on purpose — reaching LAN services
 * the admin configured is the whole point of a homelab launcher.
 */

export type HealthFailureReason =
  | "dns"
  | "connection_refused"
  | "timeout"
  | "tls"
  | "self_signed"
  | "http_error"
  | "invalid_url"
  | "unknown";

/** Safe, user-friendly default message per reason (never leaks internals). */
const REASON_MESSAGE: Record<HealthFailureReason, string> = {
  dns: "DNS lookup failed",
  connection_refused: "Connection refused",
  timeout: "Connection timed out",
  tls: "TLS/certificate error",
  self_signed: "Self-signed certificate",
  http_error: "Non-2xx HTTP response",
  invalid_url: "Invalid URL",
  unknown: "Unknown error",
};

export class HealthProbeError extends Error {
  readonly reason: HealthFailureReason;
  constructor(reason: HealthFailureReason, message?: string) {
    super(message ?? REASON_MESSAGE[reason]);
    this.name = "HealthProbeError";
    this.reason = reason;
  }
}

export interface HealthProbeOptions {
  /** Total budget across all redirect hops. */
  timeoutMs: number;
  /**
   * Trusted-internal escape hatch: skip TLS verification for THIS request only.
   * Default false (secure). Only honoured for https targets.
   */
  allowInsecureTls?: boolean;
}

export interface HealthProbeResult {
  status: number;
  durationMs: number;
}

const MAX_REDIRECTS = 5;

/**
 * Probe a URL and return its final HTTP status + latency, or throw a
 * `HealthProbeError` whose `reason` classifies the failure. Redirects are
 * followed (capped) and every hop is re-validated.
 */
export async function probeHealth(
  rawUrl: string,
  options: HealthProbeOptions,
): Promise<HealthProbeResult> {
  const startedAt = Date.now();
  const deadline = startedAt + options.timeoutMs;
  const allowInsecureTls = options.allowInsecureTls === true;

  let url = await validate(rawUrl);
  let redirects = 0;

  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new HealthProbeError("timeout");

    const res = await sendOnce(url, remaining, allowInsecureTls);
    const status = res.statusCode ?? 0;
    const location = res.headers.location;

    if (status >= 300 && status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) {
        throw new HealthProbeError("http_error", "Too many redirects");
      }
      url = await validate(new URL(location, url).toString());
      redirects += 1;
      continue;
    }

    return { status, durationMs: Date.now() - startedAt };
  }
}

/** Validate protocol + URL shape via the central guarded-fetch validator. */
async function validate(raw: string): Promise<URL> {
  try {
    // "allow": LAN/private targets are expected for a homelab launcher, so only
    // the protocol allow-list and URL shape are enforced here.
    return await validateRequestUrl(raw, "allow");
  } catch (error) {
    if (error instanceof GuardedFetchError) throw new HealthProbeError("invalid_url", error.message);
    throw new HealthProbeError("invalid_url");
  }
}

/** Perform one GET, resolving with the response head (body is drained/ignored). */
function sendOnce(url: URL, timeoutMs: number, allowInsecureTls: boolean): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const req = transport.request(
      url,
      {
        method: "GET",
        // Per-app, per-request only. Default keeps secure verification; we never
        // touch the process-global TLS setting.
        ...(isHttps && allowInsecureTls ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        // We only need status + headers; drain the body to free the socket.
        res.resume();
        resolve(res);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new HealthProbeError("timeout")));
    req.on("error", (error) => reject(classifyError(error)));
    req.end();
  });
}

/** True for TLS/certificate-validation error codes (excluding self-signed). */
function isTlsCode(code: string): boolean {
  return (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    code.startsWith("CERT_") ||
    code.includes("_CERT_") ||
    code.endsWith("_CERT")
  );
}

/** Map a low-level Node error to a safe, classified HealthProbeError. */
function classifyError(error: unknown): HealthProbeError {
  if (error instanceof HealthProbeError) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? "";

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return new HealthProbeError("dns");
    case "ECONNREFUSED":
      return new HealthProbeError("connection_refused");
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
      return new HealthProbeError("timeout");
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return new HealthProbeError("self_signed");
    default:
      if (isTlsCode(code)) return new HealthProbeError("tls");
      return new HealthProbeError("unknown");
  }
}
