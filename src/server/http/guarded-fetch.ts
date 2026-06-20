import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guarded outbound HTTP — the single SSRF chokepoint (ADR 0006).
 *
 * EVERY outbound request the server makes to a user-influenced URL (app health
 * checks in v0.1; module APIs in v0.2) goes through here. The wrapper ALWAYS
 * enforces: protocol allow-list, total timeout, redirect cap (with per-hop
 * re-validation), and a response-size cap.
 *
 * Private-IP blocking is OPT-IN, not the default, because this product's whole
 * purpose is reaching LAN services that the single admin explicitly configured.
 * Calls that fetch genuinely remote/untrusted URLs should pass
 * `privateNetwork: "block"`.
 *
 * Known limitation: validation resolves DNS then fetches by hostname, so a DNS
 * rebinding race is theoretically possible in "block" mode. Documented; pinning
 * to the resolved IP (and overriding the Host header) is a future hardening.
 */

export interface GuardedFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  /** Total budget across all redirect hops (default 10s). */
  timeoutMs?: number;
  /** Max redirects to follow, each re-validated (default 5). */
  maxRedirects?: number;
  /** Max bytes to read from the response body (default 5 MiB). */
  maxBytes?: number;
  /** Whether to allow requests that resolve to private/reserved IPs. */
  privateNetwork?: "allow" | "block";
}

export interface GuardedResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Headers;
  body: Buffer;
  bytes: number;
  durationMs: number;
}

export class GuardedFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_url"
      | "blocked_protocol"
      | "blocked_address"
      | "too_many_redirects"
      | "response_too_large"
      | "timeout"
      | "network",
  ) {
    super(message);
    this.name = "GuardedFetchError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULTS = { timeoutMs: 10_000, maxRedirects: 5, maxBytes: 5 * 1024 * 1024 };

/** True if an IP literal is loopback/private/link-local/reserved. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) return isPrivateV6(ip);
  return true; // not a literal IP -> treat as unknown/unsafe
}

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0] ?? "";
  if (addr === "::1" || addr === "::") return true;
  if (addr.startsWith("fe80")) return true; // link-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4 address.
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateV4(mapped[1]);
  return false;
}

/** Validate a URL's protocol and (optionally) that it resolves to a public IP. */
export async function validateRequestUrl(
  raw: string,
  privateNetwork: "allow" | "block",
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GuardedFetchError(`Invalid URL: ${raw}`, "invalid_url");
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new GuardedFetchError(`Blocked protocol: ${url.protocol}`, "blocked_protocol");
  }
  if (privateNetwork === "block") {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true }).catch(() => {
          throw new GuardedFetchError(`DNS lookup failed for ${host}`, "network");
        });
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      throw new GuardedFetchError(`Blocked private/reserved address for ${host}`, "blocked_address");
    }
  }
  return url;
}

export async function guardedFetch(
  rawUrl: string,
  options: GuardedFetchOptions = {},
): Promise<GuardedResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const privateNetwork = options.privateNetwork ?? "allow";

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    let currentUrl = (await validateRequestUrl(rawUrl, privateNetwork)).toString();
    let redirects = 0;

    while (true) {
      const res = await fetch(currentUrl, {
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body,
        redirect: "manual",
        signal: controller.signal,
      }).catch((error: unknown) => {
        if (controller.signal.aborted) throw new GuardedFetchError("Request timed out", "timeout");
        throw new GuardedFetchError(
          error instanceof Error ? error.message : "Network error",
          "network",
        );
      });

      // Manual redirect handling so every hop is re-validated.
      if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
        if (redirects >= maxRedirects) {
          throw new GuardedFetchError("Too many redirects", "too_many_redirects");
        }
        const next = new URL(res.headers.get("location")!, currentUrl).toString();
        currentUrl = (await validateRequestUrl(next, privateNetwork)).toString();
        redirects += 1;
        continue;
      }

      const body = await readCapped(res, maxBytes);
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        url: currentUrl,
        headers: res.headers,
        body,
        bytes: body.byteLength,
        durationMs: Date.now() - startedAt,
      };
    }
  } finally {
    clearTimeout(deadline);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new GuardedFetchError(`Response exceeded ${maxBytes} bytes`, "response_too_large");
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}
