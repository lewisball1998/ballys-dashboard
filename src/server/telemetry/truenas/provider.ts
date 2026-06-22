import { env } from "@/lib/env";
import type { TelemetrySourceStatus } from "@/lib/types";
import { TrueNasAuthError, TrueNasClient } from "./client";
import {
  indexSmartResults,
  nasSeverity,
  normaliseDatasets,
  normaliseDisks,
  normalisePools,
} from "./normalise";
import type { RawDataset, RawDisk, RawPool, RawSmartResult, TrueNasResult } from "./types";

/**
 * TrueNAS read-only telemetry provider (v0.3.2, SERVER-ONLY). Orchestrates the
 * JSON-RPC client + pure normalisers into one calm {@link TrueNasResult}.
 *
 * Contract:
 *  - NEVER throws to the caller — every failure becomes a calm `unavailable` /
 *    `not_configured` result so the Infrastructure page always renders.
 *  - NEVER exposes secrets, host paths, raw serials, or backend error text.
 *  - NEVER logs the API key or URL.
 *  - READ-ONLY: only `*.query` / `*.results` / `*.temperatures` methods are called.
 *  - BOUNDED: per-call timeouts plus an overall budget, so TrueNAS slowness can
 *    never hold the page open indefinitely.
 */

/** Overall wall-clock ceiling for the whole TrueNAS read. */
const BUDGET_MS = 7_000;
const HANDSHAKE_TIMEOUT_MS = 4_000;
const CALL_TIMEOUT_MS = 3_000;
const MAX_DISK_NAMES = 64;

const DETAIL = {
  not_configured:
    "Not configured — set TRUENAS_URL and TRUENAS_API_KEY to show read-only NAS telemetry.",
  bad_url: "Configured, but the TRUENAS_URL value is not a valid URL.",
  unreachable: "Configured, but TrueNAS could not be reached. The rest of the page is unaffected.",
  auth_failed: "Authentication failed — check the TrueNAS API key (read-only is enough).",
  no_data: "Connected, but no readable NAS telemetry was returned.",
  partial: "Connected — some NAS telemetry is unavailable on this TrueNAS version.",
  available: "Connected — read-only NAS pool, dataset and disk telemetry.",
} as const;

/** Parse the opt-in insecure flag. Anything other than an explicit truthy string
 * is `false` — TLS is verified by default. */
export function parseInsecureFlag(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** True only when both URL and API key are present. */
export function isTrueNasConfigured(cfg: {
  url?: string | undefined;
  apiKey?: string | undefined;
}): boolean {
  return Boolean(cfg.url && cfg.url.trim() && cfg.apiKey && cfg.apiKey.trim());
}

/** Resolve the source status from which queries succeeded. Pools/disks are the
 * core read; datasets round it out. Temperatures/SMART are pure enrichment and
 * do not downgrade the status (they only populate per-disk fields). */
export function resolveStatus(ok: {
  pools: boolean;
  disks: boolean;
  datasets: boolean;
}): Extract<TelemetrySourceStatus, "available" | "partial" | "unavailable"> {
  if (!(ok.pools || ok.disks)) return "unavailable";
  return ok.pools && ok.disks && ok.datasets ? "available" : "partial";
}

/** Convert the configured TRUENAS_URL + API path into a ws:// / wss:// URL. */
export function buildWebSocketUrl(rawUrl: string, apiPath: string): URL {
  const base = new URL(rawUrl); // throws on invalid — caller treats as bad_url
  const url = new URL(apiPath, base);
  url.protocol = base.protocol === "http:" || base.protocol === "ws:" ? "ws:" : "wss:";
  return url;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Coerce a `disk.temperatures` map ({ name: °C | null }) into a clean record. */
function asTempMap(value: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!value || typeof value !== "object") return out;
  for (const [name, temp] of Object.entries(value as Record<string, unknown>)) {
    out[name] = typeof temp === "number" && Number.isFinite(temp) ? temp : null;
  }
  return out;
}

function result(
  status: TelemetrySourceStatus,
  detail: string,
  extra?: Partial<TrueNasResult>,
): TrueNasResult {
  return {
    status,
    detail,
    lastRefresh: null,
    severity: "unavailable",
    pools: [],
    datasets: [],
    disks: [],
    ...extra,
  };
}

/** Collect TrueNAS telemetry. Always resolves; never throws. */
export async function collectTrueNasTelemetry(): Promise<TrueNasResult> {
  if (!isTrueNasConfigured({ url: env.TRUENAS_URL, apiKey: env.TRUENAS_API_KEY })) {
    return result("not_configured", DETAIL.not_configured);
  }

  // Race the whole read against a hard budget so a hanging NAS can't stall the
  // page. If the budget wins, the abandoned read still closes its own client.
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<TrueNasResult>((resolve) => {
    budgetTimer = setTimeout(() => resolve(result("unavailable", DETAIL.unreachable)), BUDGET_MS);
  });
  try {
    return await Promise.race([readTelemetry(), budget]);
  } catch {
    // readTelemetry is defensive, but guarantee the never-throws contract anyway.
    return result("unavailable", DETAIL.unreachable);
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
  }
}

async function readTelemetry(): Promise<TrueNasResult> {
  const url = env.TRUENAS_URL!;
  const apiKey = env.TRUENAS_API_KEY!;
  const allowInsecure = parseInsecureFlag(env.TRUENAS_ALLOW_INSECURE);

  let wsUrl: URL;
  try {
    wsUrl = buildWebSocketUrl(url, env.TRUENAS_API_PATH);
  } catch {
    return result("unavailable", DETAIL.bad_url);
  }

  let client: TrueNasClient;
  try {
    client = await TrueNasClient.open(wsUrl, {
      allowInsecure,
      handshakeTimeoutMs: HANDSHAKE_TIMEOUT_MS,
      callTimeoutMs: CALL_TIMEOUT_MS,
    });
  } catch {
    return result("unavailable", DETAIL.unreachable);
  }

  try {
    try {
      await client.authenticate(apiKey);
    } catch (err) {
      return result(
        "unavailable",
        err instanceof TrueNasAuthError ? DETAIL.auth_failed : DETAIL.unreachable,
      );
    }

    // Core + dataset reads in parallel (one WS, concurrent JSON-RPC ids).
    const [poolsR, datasetsR, disksR] = await Promise.allSettled([
      client.call("pool.query"),
      client.call("pool.dataset.query"),
      client.call("disk.query"),
    ]);

    const rawPools = poolsR.status === "fulfilled" ? asArray<RawPool>(poolsR.value) : [];
    const rawDatasets =
      datasetsR.status === "fulfilled" ? asArray<RawDataset>(datasetsR.value) : [];
    const rawDisks = disksR.status === "fulfilled" ? asArray<RawDisk>(disksR.value) : [];

    // Enrichment reads (best-effort): temperatures (needs disk names) + SMART.
    const diskNames = rawDisks
      .map((d) => (typeof d?.name === "string" ? d.name : null))
      .filter((n): n is string => Boolean(n))
      .slice(0, MAX_DISK_NAMES);
    const [tempsR, smartR] = await Promise.allSettled([
      diskNames.length > 0 ? client.call("disk.temperatures", [diskNames]) : Promise.resolve({}),
      client.call("smart.test.results"),
    ]);
    const temps = tempsR.status === "fulfilled" ? asTempMap(tempsR.value) : {};
    const smart =
      smartR.status === "fulfilled"
        ? indexSmartResults(asArray<RawSmartResult>(smartR.value))
        : {};

    const ok = {
      pools: poolsR.status === "fulfilled",
      disks: disksR.status === "fulfilled",
      datasets: datasetsR.status === "fulfilled",
    };
    const status = resolveStatus(ok);
    if (status === "unavailable") return result("unavailable", DETAIL.no_data);

    const pools = normalisePools(rawPools, rawDatasets);
    const datasets = normaliseDatasets(rawDatasets);
    const disks = normaliseDisks(rawDisks, temps, smart);

    return {
      status,
      detail: status === "available" ? DETAIL.available : DETAIL.partial,
      lastRefresh: new Date().toISOString(),
      severity: nasSeverity(pools, disks),
      pools,
      datasets,
      disks,
    };
  } finally {
    client.close();
  }
}
