import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DriveType } from "@/lib/types";

/**
 * Read-only `/sys` readers (v0.3.0, SERVER-ONLY): drive inventory, hwmon
 * temperatures/power, and best-effort GPU telemetry. Every reader is guarded and
 * returns `null`/`[]` when the source is absent (non-Linux, not mounted, no
 * permission) — a normal degraded state, never thrown.
 *
 * SMART verdicts and pool health are intentionally NOT read here: they require
 * privileged tooling (smartctl/zpool) which is out of scope for v0.3.0, so the
 * service reports them as `unavailable`.
 */

const SECTOR_BYTES = 512;

async function readNum(path: string): Promise<number | null> {
  try {
    const n = Number((await readFile(path, "utf8")).trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    const s = (await readFile(path, "utf8")).trim();
    return s.length > 0 ? s : null;
  } catch {
    return null;
  }
}

async function listDir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

// --- Drives ------------------------------------------------------------------

export interface RawDrive {
  name: string;
  type: DriveType;
  sizeBytes: number | null;
  model: string | null;
  serial: string | null;
  temperatureC: number | null;
}

const DRIVE_NAME_RE = /^(sd[a-z]+|nvme\d+n\d+|vd[a-z]+|hd[a-z]+|mmcblk\d+)$/;

function driveType(name: string, rotational: number | null): DriveType {
  if (name.startsWith("nvme")) return "nvme";
  if (rotational === 1) return "hdd";
  if (rotational === 0) return "ssd";
  return "unknown";
}

/** Read the first hwmon temperature (°C) attached to a block device, if any. */
async function readDriveTemp(deviceDir: string): Promise<number | null> {
  const hwmonRoot = join(deviceDir, "hwmon");
  for (const hw of await listDir(hwmonRoot)) {
    const milli = await readNum(join(hwmonRoot, hw, "temp1_input"));
    if (milli !== null) return Math.round(milli / 1000);
  }
  return null;
}

/** Enumerate whole block devices from `/sys/block`. */
export async function readDrives(): Promise<RawDrive[] | null> {
  const names = await listDir("/sys/block");
  if (names.length === 0) return null;
  const drives: RawDrive[] = [];
  for (const name of names) {
    if (!DRIVE_NAME_RE.test(name)) continue;
    const base = join("/sys/block", name);
    const deviceDir = join(base, "device");
    const [sectors, rotational, model, serial, temperatureC] = await Promise.all([
      readNum(join(base, "size")),
      readNum(join(base, "queue", "rotational")),
      readText(join(deviceDir, "model")),
      readText(join(deviceDir, "serial")),
      readDriveTemp(deviceDir),
    ]);
    drives.push({
      name,
      type: driveType(name, rotational),
      sizeBytes: sectors !== null ? sectors * SECTOR_BYTES : null,
      model,
      serial,
      temperatureC,
    });
  }
  return drives.sort((a, b) => a.name.localeCompare(b.name));
}

// --- hwmon helpers -----------------------------------------------------------

const CPU_HWMON_NAMES: ReadonlySet<string> = new Set([
  "coretemp",
  "k10temp",
  "zenpower",
  "cpu_thermal",
  "cpu-thermal",
  "soc_thermal",
]);

/** Read a CPU package temperature (°C) from hwmon, falling back to thermal zones. */
export async function readCpuTemperatureC(): Promise<number | null> {
  const root = "/sys/class/hwmon";
  for (const hw of await listDir(root)) {
    const name = await readText(join(root, hw, "name"));
    if (name && CPU_HWMON_NAMES.has(name)) {
      const milli = await readNum(join(root, hw, "temp1_input"));
      if (milli !== null) return Math.round(milli / 1000);
    }
  }
  // Fallback: thermal zones typed as a cpu/package sensor.
  const zoneRoot = "/sys/class/thermal";
  for (const z of await listDir(zoneRoot)) {
    if (!z.startsWith("thermal_zone")) continue;
    const type = (await readText(join(zoneRoot, z, "type")))?.toLowerCase() ?? "";
    if (type.includes("cpu") || type.includes("x86_pkg") || type.includes("soc")) {
      const milli = await readNum(join(zoneRoot, z, "temp"));
      if (milli !== null) return Math.round(milli / 1000);
    }
  }
  return null;
}

// --- GPU (best-effort, amdgpu via sysfs) -------------------------------------

export interface RawGpu {
  name: string;
  utilisationPercent: number | null;
  vramUsedBytes: number | null;
  vramTotalBytes: number | null;
  temperatureC: number | null;
  powerWatts: number | null;
  driver: string | null;
}

async function readAmdgpuHwmon(deviceDir: string): Promise<{ temp: number | null; power: number | null }> {
  const hwmonRoot = join(deviceDir, "hwmon");
  for (const hw of await listDir(hwmonRoot)) {
    const dir = join(hwmonRoot, hw);
    const milliTemp = await readNum(join(dir, "temp1_input"));
    const microPower = await readNum(join(dir, "power1_average"));
    if (milliTemp !== null || microPower !== null) {
      return {
        temp: milliTemp !== null ? Math.round(milliTemp / 1000) : null,
        power: microPower !== null ? Math.round(microPower / 1_000_000) : null,
      };
    }
  }
  return { temp: null, power: null };
}

/**
 * Best-effort GPU read via `/sys/class/drm` (amdgpu exposes utilisation, VRAM,
 * temperature, and power through sysfs). NVIDIA exposes none of this without its
 * proprietary tooling, so it degrades to "unavailable" rather than guessing.
 */
export async function readGpus(): Promise<RawGpu[]> {
  const drmRoot = "/sys/class/drm";
  const gpus: RawGpu[] = [];
  for (const card of await listDir(drmRoot)) {
    if (!/^card\d+$/.test(card)) continue;
    const deviceDir = join(drmRoot, card, "device");
    const uevent = (await readText(join(deviceDir, "uevent"))) ?? "";
    const driver = /DRIVER=(\w+)/.exec(uevent)?.[1] ?? null;
    const util = await readNum(join(deviceDir, "gpu_busy_percent"));
    const vramUsed = await readNum(join(deviceDir, "mem_info_vram_used"));
    const vramTotal = await readNum(join(deviceDir, "mem_info_vram_total"));
    // Only surface a GPU when at least one meaningful metric is present.
    if (util === null && vramUsed === null && vramTotal === null && driver !== "amdgpu") continue;
    const { temp, power } = await readAmdgpuHwmon(deviceDir);
    gpus.push({
      name: driver === "amdgpu" ? "AMD GPU" : (driver ?? "GPU"),
      utilisationPercent: util,
      vramUsedBytes: vramUsed,
      vramTotalBytes: vramTotal,
      temperatureC: temp,
      powerWatts: power,
      driver,
    });
  }
  return gpus;
}
