import type {
  DriveDTO,
  DriveType,
  HealthSeverity,
  NasDatasetDTO,
  NasPoolDTO,
  SmartStatus,
} from "@/lib/types";
import { redactSerial, sanitiseLabel } from "../redact";
import { temperatureSeverity, worstSeverity } from "../severity";
import type {
  RawCapacityValue,
  RawDataset,
  RawDisk,
  RawPool,
  RawSmartResult,
} from "./types";

/**
 * Pure normalisers for TrueNAS telemetry (v0.3.2, SERVER-ONLY). No I/O — every
 * function takes already-fetched raw JSON and returns transport-safe DTOs, so the
 * whole parsing/redaction surface is unit-testable with mocked responses.
 *
 * Defensive by design: TrueNAS field names/locations differ across versions, so
 * missing/garbage fields collapse to `null`/`unavailable` (a calm state) rather
 * than throwing. Disk serials are masked; host mountpoints are never surfaced.
 */

const round1 = (v: number) => Math.round(v * 10) / 10;

/** TrueNAS capacity values may be a number, a numeric string, or a
 * `{ parsed, rawvalue }` wrapper. Returns a finite non-negative number or null. */
export function parseCapacity(value: RawCapacityValue): number | null {
  const coerce = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    return null;
  };
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return coerce(value.parsed) ?? coerce(value.rawvalue);
  return coerce(value);
}

const POOL_CRITICAL: ReadonlySet<string> = new Set(["FAULTED", "UNAVAIL", "REMOVED"]);
const POOL_WARNING: ReadonlySet<string> = new Set(["DEGRADED", "OFFLINE"]);

/** Map a pool status string (+ optional `healthy` flag) to a severity. Unknown
 * status with no health signal is `unavailable` — never a false critical. */
export function poolStatusSeverity(
  status: string | null,
  healthy: boolean | null,
): HealthSeverity {
  const s = (status ?? "").trim().toUpperCase();
  if (POOL_CRITICAL.has(s)) return "critical";
  if (POOL_WARNING.has(s)) return "warning";
  if (s === "ONLINE") return healthy === false ? "warning" : "healthy";
  if (healthy === true) return "healthy";
  if (healthy === false) return "warning";
  return "unavailable";
}

const SMART_PASSED: ReadonlySet<string> = new Set(["PASSED", "PASS", "SUCCESS", "OK"]);
const SMART_FAILING: ReadonlySet<string> = new Set(["FAILED", "FAIL", "FAILING"]);

/** Map a raw SMART status string to a {@link SmartStatus}. In-progress/unknown →
 * `unavailable` (never `failing` without real evidence). */
export function mapSmartStatus(raw: unknown): SmartStatus {
  if (typeof raw !== "string") return "unavailable";
  const s = raw.trim().toUpperCase();
  if (SMART_PASSED.has(s)) return "passed";
  if (SMART_FAILING.has(s)) return "failing";
  return "unavailable";
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asBoolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function driveType(name: string, rawType: unknown, rotationRate: unknown): DriveType {
  if (/^nvme/i.test(name)) return "nvme";
  const t = typeof rawType === "string" ? rawType.trim().toUpperCase() : "";
  if (t === "SSD") return "ssd";
  if (t === "HDD") return "hdd";
  if (typeof rotationRate === "number" && rotationRate > 0) return "hdd";
  return "unknown";
}

/** Build a `name -> { used, available }` map of pool-root datasets (id has no
 * "/"), used to back-fill pool capacity when the pool object omits it. */
export function indexRootDatasets(
  datasets: RawDataset[],
): Map<string, { used: number | null; available: number | null }> {
  const map = new Map<string, { used: number | null; available: number | null }>();
  for (const ds of flattenDatasets(datasets)) {
    const id = asStringOrNull(ds.id) ?? asStringOrNull(ds.name);
    if (!id || id.includes("/")) continue; // only pool roots
    map.set(id, { used: parseCapacity(ds.used), available: parseCapacity(ds.available) });
  }
  return map;
}

/** Flatten TrueNAS's nested `children` dataset tree into a single list. */
export function flattenDatasets(datasets: RawDataset[]): RawDataset[] {
  const out: RawDataset[] = [];
  const walk = (list: RawDataset[] | null | undefined) => {
    if (!Array.isArray(list)) return;
    for (const ds of list) {
      if (!ds || typeof ds !== "object") continue;
      out.push(ds);
      walk(ds.children);
    }
  };
  walk(datasets);
  return out;
}

export function normalisePools(pools: RawPool[], datasets: RawDataset[] = []): NasPoolDTO[] {
  const rootById = indexRootDatasets(datasets);
  const out: NasPoolDTO[] = [];
  for (const p of pools) {
    if (!p || typeof p !== "object") continue;
    const name = asStringOrNull(p.name);
    if (!name) continue;
    const status = asStringOrNull(p.status);
    const healthy = asBoolOrNull(p.healthy);
    const root = rootById.get(name);

    let total = parseCapacity(p.size);
    let used = parseCapacity(p.allocated);
    let free = parseCapacity(p.free);
    if (total === null && root && root.used !== null && root.available !== null) {
      total = root.used + root.available;
    }
    if (used === null && root) used = root.used;
    if (free === null) {
      free = total !== null && used !== null ? Math.max(0, total - used) : (root?.available ?? null);
    }
    const usagePercent =
      total !== null && total > 0 && used !== null ? round1((100 * used) / total) : null;

    out.push({
      name: sanitiseLabel(name) ?? name,
      severity: poolStatusSeverity(status, healthy),
      health: status ? (sanitiseLabel(status, 32) ?? null) : null,
      usedBytes: used,
      freeBytes: free,
      totalBytes: total,
      usagePercent,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function normaliseDatasets(datasets: RawDataset[], max = 24): NasDatasetDTO[] {
  const out: NasDatasetDTO[] = [];
  for (const ds of flattenDatasets(datasets)) {
    const name = asStringOrNull(ds.name) ?? asStringOrNull(ds.id);
    // Skip pool roots (no "/"): their capacity already shows in the pools view.
    if (!name || !name.includes("/")) continue;
    const used = parseCapacity(ds.used);
    const available = parseCapacity(ds.available);
    const total = used !== null && available !== null ? used + available : null;
    const usagePercent =
      total !== null && total > 0 && used !== null ? round1((100 * used) / total) : null;
    out.push({
      // Dataset names ("pool/child") are not absolute paths, so they survive
      // sanitiseLabel; a leaked mountpoint ("/mnt/...") would be dropped to null.
      name: sanitiseLabel(name) ?? name,
      usedBytes: used,
      availableBytes: available,
      totalBytes: total,
      usagePercent,
    });
  }
  return out
    .sort((a, b) => (b.usedBytes ?? 0) - (a.usedBytes ?? 0) || a.name.localeCompare(b.name))
    .slice(0, max);
}

/** Build a `diskName -> { status, lastCheck }` map from raw SMART results. */
export function indexSmartResults(
  results: RawSmartResult[],
): Record<string, { status: SmartStatus; lastCheck: string | null }> {
  const out: Record<string, { status: SmartStatus; lastCheck: string | null }> = {};
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const disk = asStringOrNull(r.disk);
    if (!disk) continue;
    // Prefer the most recent completed test; fall back to current_test status.
    const tests = Array.isArray(r.tests) ? r.tests : [];
    const latest = tests[tests.length - 1];
    const status = mapSmartStatus(latest?.status ?? latest?.status_verbose ?? r.current_test);
    const lastCheck = normaliseSmartTime(latest?.datetime ?? latest?.time);
    out[disk] = { status, lastCheck };
  }
  return out;
}

/** Coerce a SMART test timestamp to an ISO string, or null. TrueNAS may send a
 * `{ $date: ms }` wrapper, an epoch number, or an ISO string. */
export function normaliseSmartTime(value: unknown): string | null {
  let ms: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) {
    ms = value < 1e12 ? value * 1000 : value; // seconds vs milliseconds
  } else if (value && typeof value === "object" && "$date" in value) {
    const d = (value as { $date?: unknown }).$date;
    if (typeof d === "number" && Number.isFinite(d)) ms = d;
  } else if (typeof value === "string") {
    const t = Date.parse(value);
    if (Number.isFinite(t)) ms = t;
  }
  if (ms === null) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normaliseDisks(
  disks: RawDisk[],
  temps: Record<string, number | null> = {},
  smart: Record<string, { status: SmartStatus; lastCheck: string | null }> = {},
  max = 64,
): DriveDTO[] {
  const out: DriveDTO[] = [];
  for (const d of disks) {
    if (!d || typeof d !== "object") continue;
    const name = asStringOrNull(d.name) ?? asStringOrNull(d.devname);
    if (!name) continue;
    const rawTemp = temps[name];
    const temperatureC =
      typeof rawTemp === "number" && Number.isFinite(rawTemp) ? Math.round(rawTemp) : null;
    const s = smart[name];
    out.push({
      name,
      model: sanitiseLabel(asStringOrNull(d.model)),
      type: driveType(name, d.type, d.rotationrate),
      sizeBytes: parseCapacity(d.size),
      temperatureC,
      temperatureSeverity: temperatureSeverity(temperatureC),
      smartStatus: s?.status ?? "unavailable",
      serial: redactSerial(asStringOrNull(d.serial)),
      lastSmartCheck: s?.lastCheck ?? null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, max);
}

const SMART_SEVERITY: Record<SmartStatus, HealthSeverity> = {
  passed: "healthy",
  failing: "critical",
  unavailable: "unavailable",
};

/** Roll up NAS health from pool statuses, drive temperatures and SMART verdicts.
 * `unavailable` is the weakest signal, so partial telemetry never reads critical. */
export function nasSeverity(pools: NasPoolDTO[], disks: DriveDTO[]): HealthSeverity {
  return worstSeverity([
    ...pools.map((p) => p.severity),
    ...disks.map((d) => d.temperatureSeverity),
    ...disks.map((d) => SMART_SEVERITY[d.smartStatus]),
  ]);
}
