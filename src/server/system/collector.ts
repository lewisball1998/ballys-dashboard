import os from "node:os";
import { readFile, statfs } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "@/lib/env";
import type { MetricPoint } from "@/modules/types";

/**
 * Local system metrics collector. Reports CONTAINER-VISIBLE stats (ADR 0008):
 * inside Docker these reflect cgroup limits / mounted filesystems, not the host,
 * unless the operator adds the optional read-only mounts documented later.
 *
 * CPU and network are rate/delta based, so they require a previous sample —
 * the first collect() omits them; subsequent calls include them.
 */

let prevCpu: { idle: number; total: number } | null = null;
let prevNet: { rx: number; tx: number; at: number } | null = null;

const clampPct = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function sampleCpu(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

async function sampleNetwork(): Promise<{ rx: number; tx: number } | null> {
  try {
    const data = await readFile("/proc/net/dev", "utf8");
    const lines = data.trim().split("\n").slice(2); // skip 2 header lines
    let rx = 0;
    let tx = 0;
    for (const line of lines) {
      const parts = line.split(":");
      const iface = parts[0];
      const rest = parts[1];
      if (!iface || rest === undefined) continue;
      if (iface.trim() === "lo") continue;
      const cols = rest.trim().split(/\s+/).map(Number);
      rx += cols[0] ?? 0; // receive bytes
      tx += cols[8] ?? 0; // transmit bytes
    }
    return { rx, tx };
  } catch {
    return null; // /proc/net/dev not available (non-Linux); skip network
  }
}

export async function collectSystemMetrics(): Promise<MetricPoint[]> {
  const at = new Date();
  const points: MetricPoint[] = [];

  // --- CPU (delta-based) ---
  const cpu = sampleCpu();
  if (prevCpu) {
    const dIdle = cpu.idle - prevCpu.idle;
    const dTotal = cpu.total - prevCpu.total;
    if (dTotal > 0) {
      points.push({
        sourceId: "cpu",
        metric: "usage_percent",
        value: round1(clampPct(100 * (1 - dIdle / dTotal))),
        unit: "%",
        recordedAt: at,
      });
    }
  }
  prevCpu = cpu;

  // --- Memory ---
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  points.push(
    {
      sourceId: "memory",
      metric: "usage_percent",
      value: round1(totalMem > 0 ? (100 * usedMem) / totalMem : 0),
      unit: "%",
      recordedAt: at,
    },
    { sourceId: "memory", metric: "bytes_total", value: totalMem, unit: "bytes", recordedAt: at },
    { sourceId: "memory", metric: "bytes_used", value: usedMem, unit: "bytes", recordedAt: at },
  );

  // --- Storage (the data volume's filesystem) ---
  try {
    const dir = dirname(resolve(env.DATABASE_PATH));
    const s = await statfs(dir);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    const used = total - free;
    points.push(
      {
        sourceId: "storage",
        metric: "usage_percent",
        value: round1(total > 0 ? (100 * used) / total : 0),
        unit: "%",
        recordedAt: at,
      },
      { sourceId: "storage", metric: "bytes_total", value: total, unit: "bytes", recordedAt: at },
      { sourceId: "storage", metric: "bytes_used", value: used, unit: "bytes", recordedAt: at },
    );
  } catch {
    // statfs unavailable; skip storage this cycle
  }

  // --- Network (delta-based rate) ---
  const net = await sampleNetwork();
  if (net) {
    const now = Date.now();
    if (prevNet) {
      const dt = (now - prevNet.at) / 1000;
      if (dt > 0) {
        points.push(
          {
            sourceId: "network",
            metric: "rx_bytes_per_sec",
            value: round1(Math.max(0, (net.rx - prevNet.rx) / dt)),
            unit: "bytes/s",
            recordedAt: at,
          },
          {
            sourceId: "network",
            metric: "tx_bytes_per_sec",
            value: round1(Math.max(0, (net.tx - prevNet.tx) / dt)),
            unit: "bytes/s",
            recordedAt: at,
          },
        );
      }
    }
    prevNet = { rx: net.rx, tx: net.tx, at: now };
  }

  // --- Uptime ---
  points.push(
    { sourceId: "uptime", metric: "system_seconds", value: Math.round(os.uptime()), unit: "s", recordedAt: at },
    { sourceId: "uptime", metric: "process_seconds", value: Math.round(process.uptime()), unit: "s", recordedAt: at },
  );

  return points;
}
