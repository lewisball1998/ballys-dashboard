/**
 * Metrics read DTOs. ⭐ ARCHITECT-OWNED (additive — see api-contract.md, which
 * deferred this DTO to "when Backend lands the collector"). Mirrors the
 * `metrics` table with an ISO-string timestamp. Backend authored this to deliver
 * the in-scope GET /api/metrics endpoint; pending Architect ratification.
 */
export interface MetricPointDTO {
  /** "system" in v0.1; "module" for integration metrics later. */
  sourceType: string;
  /** e.g. "cpu" | "memory" | "storage" | "network" | "uptime". */
  sourceId: string;
  /** e.g. "usage_percent" | "bytes_total" | "rx_bytes_per_sec". */
  metric: string;
  value: number;
  unit: string | null;
  recordedAt: string;
}

export interface MetricsResponseDTO {
  points: MetricPointDTO[];
}
