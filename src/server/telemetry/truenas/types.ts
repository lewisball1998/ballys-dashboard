import type {
  DriveDTO,
  HealthSeverity,
  NasDatasetDTO,
  NasPoolDTO,
  TelemetrySourceStatus,
} from "@/lib/types";

/**
 * Strict types for the TrueNAS read-only telemetry provider (v0.3.2, SERVER-ONLY).
 *
 * Raw shapes describe (loosely) what the TrueNAS middleware JSON-RPC API returns.
 * They are intentionally permissive — every field is optional/unknown and field
 * names/locations differ across TrueNAS versions — so the pure normalisers in
 * `normalise.ts` can validate + coerce them defensively without throwing.
 */

/** TrueNAS often wraps a numeric capacity as `{ parsed, rawvalue }`; sometimes it
 * is a plain number or a numeric string. Normalisers accept all three. */
export type RawCapacityValue =
  | number
  | string
  | { parsed?: number | string | null; rawvalue?: string | null }
  | null
  | undefined;

/** `pool.query` element (capacity may live here or on the root dataset). */
export interface RawPool {
  name?: unknown;
  status?: unknown;
  healthy?: unknown;
  size?: RawCapacityValue;
  allocated?: RawCapacityValue;
  free?: RawCapacityValue;
}

/** `pool.dataset.query` element (may nest `children`). */
export interface RawDataset {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  mountpoint?: unknown;
  used?: RawCapacityValue;
  available?: RawCapacityValue;
  children?: RawDataset[] | null;
}

/** `disk.query` element. */
export interface RawDisk {
  name?: unknown;
  devname?: unknown;
  model?: unknown;
  serial?: unknown;
  size?: RawCapacityValue;
  type?: unknown;
  rotationrate?: unknown;
}

/** A single SMART test result row (shape varies across versions). */
export interface RawSmartTest {
  status?: unknown;
  status_verbose?: unknown;
  time?: unknown;
  datetime?: unknown;
}

/** `smart.test.results` element — tests grouped per disk. */
export interface RawSmartResult {
  disk?: unknown;
  tests?: RawSmartTest[] | null;
  current_test?: unknown;
}

/** Normalised, redacted result the provider hands back to the orchestrator. It
 * never carries secrets, host paths, raw serials, or backend error text. */
export interface TrueNasResult {
  status: TelemetrySourceStatus;
  /** Calm, client-safe one-liner — never a raw backend error or stack trace. */
  detail: string;
  lastRefresh: string | null;
  severity: HealthSeverity;
  pools: NasPoolDTO[];
  datasets: NasDatasetDTO[];
  disks: DriveDTO[];
}
