/**
 * Infrastructure & hardware telemetry read DTOs (v0.3.0). Transport-safe shapes
 * for the Infrastructure page. Server-side telemetry is normalised + redacted
 * into these before it reaches the client: no secrets, host paths, raw serials,
 * Docker socket details, or backend errors ever appear here.
 *
 * Everything is "where available": missing data is `null` / `unavailable`, which
 * is a calm degraded state, NOT a fault.
 */

/** Health severity for any monitored resource. `unavailable` is never an error. */
export type HealthSeverity = "healthy" | "warning" | "critical" | "unavailable";

/** Connection state of a telemetry provider. */
export type TelemetrySourceStatus = "available" | "partial" | "unavailable" | "not_configured";

/** One telemetry provider's connectivity, surfaced to the user. */
export interface TelemetrySourceDTO {
  /** Stable id: "local" | "docker" | "truenas". */
  id: string;
  label: string;
  status: TelemetrySourceStatus;
  /** Friendly one-liner — never a raw backend error. */
  detail: string;
  /** ISO timestamp of the last successful read, or null. */
  lastRefresh: string | null;
}

/** An important infrastructure issue worth surfacing in the summary. Only real
 * warning/critical conditions become alerts — unavailable telemetry does not. */
export interface InfrastructureAlertDTO {
  id: string;
  severity: Extract<HealthSeverity, "warning" | "critical">;
  title: string;
  detail: string;
  /** Originating area: "cpu" | "memory" | "storage" | "drive" | "network" | "gpu". */
  source: string;
}

/** A resource consumer (Docker container / app), safely summarised. */
export interface ConsumerDTO {
  name: string;
  /** CPU share, when this is a CPU consumer list. */
  usagePercent?: number | null;
  /** Memory bytes, when this is a memory consumer list. */
  bytes?: number | null;
}

export interface CpuTelemetryDTO {
  severity: HealthSeverity;
  usagePercent: number | null;
  loadAverage: [number, number, number] | null;
  /** Logical cores / threads. */
  cores: number | null;
  model: string | null;
  clockMhz: number | null;
  temperatureC: number | null;
  temperatureSeverity: HealthSeverity;
  /** Top CPU consumers grouped by container/app (empty when unavailable). */
  topConsumers: ConsumerDTO[];
}

export interface MemoryTelemetryDTO {
  severity: HealthSeverity;
  usagePercent: number | null;
  totalBytes: number | null;
  usedBytes: number | null;
  availableBytes: number | null;
  cachedBytes: number | null;
  buffersBytes: number | null;
  swapTotalBytes: number | null;
  swapUsedBytes: number | null;
  topConsumers: ConsumerDTO[];
}

export interface GpuDeviceDTO {
  name: string;
  severity: HealthSeverity;
  utilisationPercent: number | null;
  vramUsedBytes: number | null;
  vramTotalBytes: number | null;
  temperatureC: number | null;
  temperatureSeverity: HealthSeverity;
  powerWatts: number | null;
  driver: string | null;
}

export interface GpuTelemetryDTO {
  status: TelemetrySourceStatus;
  devices: GpuDeviceDTO[];
}

export interface NetworkInterfaceDTO {
  name: string;
  rxBytesPerSec: number | null;
  txBytesPerSec: number | null;
  rxTotalBytes: number;
  txTotalBytes: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
}

export interface NetworkTelemetryDTO {
  severity: HealthSeverity;
  rxBytesPerSec: number | null;
  txBytesPerSec: number | null;
  interfaces: NetworkInterfaceDTO[];
}

export type DriveType = "hdd" | "ssd" | "nvme" | "unknown";
export type SmartStatus = "passed" | "failing" | "unavailable";

export interface DriveDTO {
  name: string;
  model: string | null;
  type: DriveType;
  sizeBytes: number | null;
  temperatureC: number | null;
  temperatureSeverity: HealthSeverity;
  smartStatus: SmartStatus;
  /** Redacted serial (e.g. "WD…A1B2"), or null when unavailable. */
  serial: string | null;
  lastSmartCheck: string | null;
}

export interface StoragePoolDTO {
  name: string;
  severity: HealthSeverity;
  /** Pool/filesystem health label where a pool source is available, else null. */
  health: string | null;
  usedBytes: number | null;
  freeBytes: number | null;
  totalBytes: number | null;
  usagePercent: number | null;
  isBoot: boolean;
}

export interface StorageTelemetryDTO {
  severity: HealthSeverity;
  pools: StoragePoolDTO[];
  drives: DriveDTO[];
}

export interface UptimeTelemetryDTO {
  systemSeconds: number | null;
  processSeconds: number | null;
}

export interface InfrastructureTelemetryDTO {
  generatedAt: string;
  sources: TelemetrySourceDTO[];
  alerts: InfrastructureAlertDTO[];
  cpu: CpuTelemetryDTO;
  memory: MemoryTelemetryDTO;
  gpu: GpuTelemetryDTO;
  network: NetworkTelemetryDTO;
  storage: StorageTelemetryDTO;
  uptime: UptimeTelemetryDTO;
}
