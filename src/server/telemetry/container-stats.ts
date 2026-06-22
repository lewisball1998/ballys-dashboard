import { dockerRequest, DockerUnavailableError } from "@/server/docker/engine";
import { getDockerContainers } from "@/server/services/docker";

/**
 * Best-effort per-container resource usage for the "top consumers" panels
 * (v0.3.0, SERVER-ONLY). Resource usage is grouped by Docker container/app — we
 * never read or expose host process details, command lines, or paths.
 *
 * Bounded by design: only running containers, capped count, limited concurrency
 * and a short per-request timeout, so a slow/large daemon cannot stall the page.
 * Degrades cleanly to `available: false` when the socket is absent.
 */

const MAX_CONTAINERS = 20;
const CONCURRENCY = 4;
const STATS_TIMEOUT_MS = 3_000;
/** Overall wall-clock budget for the whole panel. Docker's `stream=0` stats call
 * blocks ~1–2s each (it samples a CPU delta window), so a host with many running
 * containers could otherwise hold the Infrastructure page for ~9s. Past the
 * budget we stop starting new reads and return whatever arrived — a calm partial
 * result for a best-effort panel, never a page stall. */
const STATS_BUDGET_MS = 2_500;

export interface ContainerStat {
  name: string;
  cpuPercent: number | null;
  memBytes: number | null;
}

export interface ContainerStatsResult {
  available: boolean;
  stats: ContainerStat[];
}

interface RawStats {
  name?: string;
  cpu_stats?: RawCpu;
  precpu_stats?: RawCpu;
  memory_stats?: { usage?: number; stats?: { cache?: number; inactive_file?: number }; limit?: number };
}
interface RawCpu {
  cpu_usage?: { total_usage?: number };
  system_cpu_usage?: number;
  online_cpus?: number;
}

/** Docker CPU% from a single `stream=0` snapshot (precpu is the prior read). */
export function computeCpuPercent(raw: RawStats): number | null {
  const cpu = raw.cpu_stats;
  const pre = raw.precpu_stats;
  const total = cpu?.cpu_usage?.total_usage;
  const preTotal = pre?.cpu_usage?.total_usage;
  const system = cpu?.system_cpu_usage;
  const preSystem = pre?.system_cpu_usage;
  if (total === undefined || preTotal === undefined || system === undefined || preSystem === undefined) {
    return null;
  }
  const cpuDelta = total - preTotal;
  const systemDelta = system - preSystem;
  if (systemDelta <= 0 || cpuDelta < 0) return null;
  const cores = cpu?.online_cpus && cpu.online_cpus > 0 ? cpu.online_cpus : 1;
  const pct = (cpuDelta / systemDelta) * cores * 100;
  return Math.round(Math.min(100 * cores, Math.max(0, pct)) * 10) / 10;
}

/** Working-set memory in bytes (usage minus reclaimable page cache). */
export function computeMemBytes(raw: RawStats): number | null {
  const mem = raw.memory_stats;
  if (!mem || mem.usage === undefined) return null;
  const cache = mem.stats?.inactive_file ?? mem.stats?.cache ?? 0;
  return Math.max(0, mem.usage - cache);
}

async function fetchOne(id: string, name: string): Promise<ContainerStat | null> {
  try {
    const res = await dockerRequest("GET", `/containers/${id}/stats?stream=0`, STATS_TIMEOUT_MS);
    if (res.status !== 200) return null;
    const raw = JSON.parse(res.body) as RawStats;
    return { name, cpuPercent: computeCpuPercent(raw), memBytes: computeMemBytes(raw) };
  } catch {
    return null; // an individual stat failure must not fail the whole panel
  }
}

/** Map a small concurrency-limited pool over the running containers. */
export async function collectContainerStats(): Promise<ContainerStatsResult> {
  let containers;
  try {
    containers = await getDockerContainers();
  } catch (err) {
    if (err instanceof DockerUnavailableError) return { available: false, stats: [] };
    throw err;
  }
  if (!containers.availability.available) return { available: false, stats: [] };

  const running = containers.groups
    .flatMap((g) => g.containers)
    .filter((c) => c.state === "running")
    .slice(0, MAX_CONTAINERS);
  if (running.length === 0) return { available: true, stats: [] };

  const out: ContainerStat[] = [];
  let cursor = 0;
  const startedAt = Date.now();
  async function worker() {
    // Stop pulling new containers once the budget is spent; an already in-flight
    // read still has its own per-request timeout, so the worst case is bounded.
    while (cursor < running.length && Date.now() - startedAt < STATS_BUDGET_MS) {
      const c = running[cursor++];
      if (!c) continue;
      const stat = await fetchOne(c.id, c.name);
      if (stat) out.push(stat);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, running.length) }, worker));
  return { available: true, stats: out };
}
