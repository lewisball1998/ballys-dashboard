import os from "node:os";
import { statfs } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { env } from "@/lib/env";
import type {
  ConsumerDTO,
  CpuTelemetryDTO,
  DriveDTO,
  GpuTelemetryDTO,
  HealthSeverity,
  InfrastructureAlertDTO,
  InfrastructureTelemetryDTO,
  MemoryTelemetryDTO,
  NetworkInterfaceDTO,
  NetworkTelemetryDTO,
  StoragePoolDTO,
  StorageTelemetryDTO,
  TelemetrySourceDTO,
  UptimeTelemetryDTO,
} from "@/lib/types";
import { getSettings } from "@/server/services/settings";
import { getLatestMetrics } from "@/server/services/metrics";
import { capacitySeverity, isAlertable, temperatureSeverity, worstSeverity } from "./severity";
import { redactSerial, sanitiseLabel } from "./redact";
import { pickAppDataMount, readMeminfo, readMounts, readNetDev } from "./proc";
import { readCpuTemperatureC, readDrives, readGpus } from "./sysfs";
import { collectContainerStats, type ContainerStat } from "./container-stats";

/**
 * Infrastructure telemetry orchestrator (v0.3.0, SERVER-ONLY). Reads only
 * read-only local sources (`/proc`, `/sys`) plus the already-opt-in Docker
 * socket, normalises + redacts everything into transport-safe DTOs, and reports
 * per-source status + real alerts. Nothing here throws to the route: every
 * source degrades to a calm `unavailable`/`null` state.
 */

const MAX_POOLS = 12;
const TOP_CONSUMERS = 5;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** A reading is only meaningful when it is a finite, positive number; 0 / NaN /
 * Infinity / null all collapse to `null` (rendered as "—"), never a bogus value
 * such as a 0 MHz CPU clock on a host that doesn't expose the real frequency. */
const positiveFiniteOrNull = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

// Per-interface byte counters from the previous call, for rate (bytes/sec)
// computation across requests — mirrors the core collector's delta approach.
const prevNet = new Map<string, { rx: number; tx: number; at: number }>();

function poolLabel(mountpoint: string): { label: string; isBoot: boolean } {
  if (mountpoint === "/") return { label: "root", isBoot: true };
  return { label: basename(mountpoint) || mountpoint, isBoot: false };
}

async function buildStoragePools(warnPct: number): Promise<StoragePoolDTO[]> {
  const mounts = await readMounts();
  if (!mounts) return []; // no /proc/mounts → clean "unavailable" storage state
  const critPct = Math.min(99, warnPct + 10);
  // The filesystem holding the app's own data volume — labelled as app/container
  // storage so it is never mistaken for a NAS pool.
  const appDataDir = dirname(resolve(env.DATABASE_PATH));
  const appDataMount = pickAppDataMount(
    mounts.map((m) => m.mountpoint),
    appDataDir,
  );
  const seenDevice = new Set<string>();
  const pools: StoragePoolDTO[] = [];
  for (const m of mounts) {
    if (seenDevice.has(m.device)) continue;
    seenDevice.add(m.device);
    try {
      const s = await statfs(m.mountpoint);
      const total = s.blocks * s.bsize;
      const free = s.bavail * s.bsize;
      if (total <= 0) continue;
      const used = Math.max(0, total - free);
      const usagePercent = round1((100 * used) / total);
      const { label, isBoot } = poolLabel(m.mountpoint);
      pools.push({
        name: label,
        severity: capacitySeverity(usagePercent, warnPct, critPct),
        health: null, // pool health needs a pool source (ZFS/TrueNAS) — v0.4+
        usedBytes: used,
        freeBytes: free,
        totalBytes: total,
        usagePercent,
        isBoot,
        isAppData: m.mountpoint === appDataMount,
      });
    } catch {
      // statfs failed for this mount; skip it
    }
  }
  return pools
    .sort((a, b) => Number(b.isBoot) - Number(a.isBoot) || (b.totalBytes ?? 0) - (a.totalBytes ?? 0))
    .slice(0, MAX_POOLS);
}

async function buildDrives(): Promise<DriveDTO[]> {
  const raw = await readDrives();
  if (!raw) return [];
  return raw.map((d) => ({
    name: d.name,
    model: sanitiseLabel(d.model),
    type: d.type,
    sizeBytes: d.sizeBytes,
    temperatureC: d.temperatureC,
    temperatureSeverity: temperatureSeverity(d.temperatureC),
    // SMART verdicts require smartctl (privileged) — out of scope for v0.3.0.
    smartStatus: "unavailable",
    serial: redactSerial(d.serial),
    lastSmartCheck: null,
  }));
}

async function buildNetwork(): Promise<NetworkTelemetryDTO> {
  const rows = await readNetDev();
  if (!rows || rows.length === 0) {
    return { severity: "unavailable", rxBytesPerSec: null, txBytesPerSec: null, interfaces: [] };
  }
  const now = Date.now();
  let aggRx = 0;
  let aggTx = 0;
  let haveRate = false;
  const interfaces: NetworkInterfaceDTO[] = rows.map((r) => {
    const prev = prevNet.get(r.name);
    let rxRate: number | null = null;
    let txRate: number | null = null;
    if (prev) {
      const dt = (now - prev.at) / 1000;
      if (dt > 0) {
        rxRate = round1(Math.max(0, (r.rxBytes - prev.rx) / dt));
        txRate = round1(Math.max(0, (r.txBytes - prev.tx) / dt));
        aggRx += rxRate;
        aggTx += txRate;
        haveRate = true;
      }
    }
    prevNet.set(r.name, { rx: r.rxBytes, tx: r.txBytes, at: now });
    return {
      name: r.name,
      rxBytesPerSec: rxRate,
      txBytesPerSec: txRate,
      rxTotalBytes: r.rxBytes,
      txTotalBytes: r.txBytes,
      rxErrors: r.rxErrors,
      txErrors: r.txErrors,
      rxDropped: r.rxDropped,
      txDropped: r.txDropped,
    };
  });
  return {
    severity: "healthy",
    rxBytesPerSec: haveRate ? round1(aggRx) : null,
    txBytesPerSec: haveRate ? round1(aggTx) : null,
    interfaces,
  };
}

function topBy(stats: ContainerStat[], key: "cpuPercent" | "memBytes"): ConsumerDTO[] {
  return stats
    .filter((s) => s[key] !== null && (s[key] as number) > 0)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, TOP_CONSUMERS)
    .map((s) =>
      key === "cpuPercent"
        ? { name: s.name, usagePercent: s.cpuPercent }
        : { name: s.name, bytes: s.memBytes },
    );
}

export async function collectInfrastructureTelemetry(): Promise<InfrastructureTelemetryDTO> {
  const generatedAt = new Date().toISOString();
  const { thresholds } = getSettings();

  const [cpuTempC, drives, gpus, pools, network, containerStats, mem] = await Promise.all([
    readCpuTemperatureC(),
    buildDrives(),
    readGpus(),
    buildStoragePools(thresholds.storagePercent),
    buildNetwork(),
    collectContainerStats(),
    readMeminfo(),
  ]);
  const latest = getLatestMetrics();

  // --- CPU ---
  const cpus = os.cpus();
  const cpuUsage =
    latest.find((p) => p.sourceId === "cpu" && p.metric === "usage_percent")?.value ?? null;
  const cpuUsageSeverity = capacitySeverity(
    cpuUsage,
    thresholds.cpuPercent,
    Math.min(99, thresholds.cpuPercent + 10),
  );
  const cpuTempSeverity = temperatureSeverity(cpuTempC);
  const cpu: CpuTelemetryDTO = {
    severity: worstSeverity([cpuUsageSeverity, cpuTempSeverity]),
    usagePercent: cpuUsage,
    loadAverage: os.platform() === "win32" ? null : (os.loadavg() as [number, number, number]),
    cores: cpus.length || null,
    model: sanitiseLabel(cpus[0]?.model ?? null),
    // Some hosts report 0 MHz when they don't expose the real frequency — that is
    // "unknown", not a real clock, so normalise it (and any non-finite) to null.
    clockMhz: positiveFiniteOrNull(cpus[0]?.speed),
    temperatureC: cpuTempC,
    temperatureSeverity: cpuTempSeverity,
    topConsumers: topBy(containerStats.stats, "cpuPercent"),
  };

  // --- Memory (prefer /proc/meminfo, fall back to os totals) ---
  const totalBytes = mem?.totalBytes ?? os.totalmem();
  const availableBytes = mem?.availableBytes ?? os.freemem();
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  const memPercent = totalBytes > 0 ? round1((100 * usedBytes) / totalBytes) : null;
  const memSeverity = capacitySeverity(
    memPercent,
    thresholds.memoryPercent,
    Math.min(99, thresholds.memoryPercent + 8),
  );
  const memory: MemoryTelemetryDTO = {
    severity: memSeverity,
    usagePercent: memPercent,
    totalBytes,
    usedBytes,
    availableBytes,
    cachedBytes: mem?.cachedBytes ?? null,
    buffersBytes: mem?.buffersBytes ?? null,
    swapTotalBytes: mem?.swapTotalBytes ?? null,
    swapUsedBytes:
      mem?.swapTotalBytes != null && mem?.swapFreeBytes != null
        ? Math.max(0, mem.swapTotalBytes - mem.swapFreeBytes)
        : null,
    topConsumers: topBy(containerStats.stats, "memBytes"),
  };

  // --- GPU ---
  const gpu: GpuTelemetryDTO = {
    status: gpus.length > 0 ? "available" : "unavailable",
    devices: gpus.map((g) => ({
      name: sanitiseLabel(g.name) ?? "GPU",
      severity: worstSeverity([
        temperatureSeverity(g.temperatureC),
        capacitySeverity(g.utilisationPercent, 90, 98),
      ]),
      utilisationPercent: g.utilisationPercent,
      vramUsedBytes: g.vramUsedBytes,
      vramTotalBytes: g.vramTotalBytes,
      temperatureC: g.temperatureC,
      temperatureSeverity: temperatureSeverity(g.temperatureC),
      powerWatts: g.powerWatts,
      driver: sanitiseLabel(g.driver),
    })),
  };

  // --- Storage ---
  const storage: StorageTelemetryDTO = {
    severity: worstSeverity([
      ...pools.map((p) => p.severity),
      ...drives.map((d) => d.temperatureSeverity),
    ]),
    pools,
    drives,
  };

  // --- Uptime ---
  const uptime: UptimeTelemetryDTO = {
    systemSeconds: Math.round(os.uptime()),
    processSeconds: Math.round(process.uptime()),
  };

  // --- Source statuses ---
  const deepHardwareVisible = drives.length > 0 || cpuTempC !== null;
  const sources: TelemetrySourceDTO[] = [
    {
      id: "local",
      label: "Local system",
      status: deepHardwareVisible ? "available" : "partial",
      detail: deepHardwareVisible
        ? "Connected — container-visible system metrics and hardware sensors."
        : "Connected — container-visible system metrics (no hardware sensors mounted).",
      lastRefresh: generatedAt,
    },
    {
      id: "docker",
      label: "Docker",
      status: containerStats.available ? "available" : "not_configured",
      detail: containerStats.available
        ? "Connected — per-container resource usage."
        : "Not connected — optional Docker socket gives per-app usage.",
      lastRefresh: containerStats.available ? generatedAt : null,
    },
    {
      id: "truenas",
      label: "TrueNAS",
      status: "not_configured",
      detail: "Not configured — NAS pool & SMART telemetry is planned for a future release.",
      lastRefresh: null,
    },
  ];

  const alerts = buildAlerts(cpu, cpuUsageSeverity, memory, storage, gpu);

  return { generatedAt, sources, alerts, cpu, memory, gpu, network, storage, uptime };
}

function buildAlerts(
  cpu: CpuTelemetryDTO,
  cpuUsageSeverity: HealthSeverity,
  memory: MemoryTelemetryDTO,
  storage: StorageTelemetryDTO,
  gpu: GpuTelemetryDTO,
): InfrastructureAlertDTO[] {
  const alerts: InfrastructureAlertDTO[] = [];
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

  if (isAlertable(cpuUsageSeverity)) {
    alerts.push({
      id: "cpu-usage",
      severity: cpuUsageSeverity,
      title: "High CPU usage",
      detail: `CPU at ${pct(cpu.usagePercent)}.`,
      source: "cpu",
    });
  }
  if (isAlertable(cpu.temperatureSeverity)) {
    alerts.push({
      id: "cpu-temp",
      severity: cpu.temperatureSeverity,
      title: "High CPU temperature",
      detail: `CPU at ${cpu.temperatureC}°C.`,
      source: "cpu",
    });
  }
  if (isAlertable(memory.severity)) {
    alerts.push({
      id: "memory-usage",
      severity: memory.severity,
      title: "High memory usage",
      detail: `Memory at ${pct(memory.usagePercent)}.`,
      source: "memory",
    });
  }
  for (const p of storage.pools) {
    if (isAlertable(p.severity)) {
      alerts.push({
        id: `pool-${p.name}`,
        severity: p.severity,
        title: `Storage filling up: ${p.name}`,
        detail: `${p.name} at ${pct(p.usagePercent)} capacity.`,
        source: "storage",
      });
    }
  }
  for (const d of storage.drives) {
    if (isAlertable(d.temperatureSeverity)) {
      alerts.push({
        id: `drive-${d.name}`,
        severity: d.temperatureSeverity,
        title: `Drive running hot: ${d.name}`,
        detail: `${d.name} at ${d.temperatureC}°C.`,
        source: "drive",
      });
    }
  }
  for (const g of gpu.devices) {
    if (isAlertable(g.temperatureSeverity)) {
      alerts.push({
        id: `gpu-${g.name}`,
        severity: g.temperatureSeverity,
        title: `GPU running hot: ${g.name}`,
        detail: `${g.name} at ${g.temperatureC}°C.`,
        source: "gpu",
      });
    }
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}
