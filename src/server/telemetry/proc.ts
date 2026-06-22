import { readFile } from "node:fs/promises";

/**
 * Read-only `/proc` parsers + guarded readers (v0.3.0, SERVER-ONLY).
 *
 * Pure parse functions are exported for unit testing; the async readers wrap them
 * and return `null` when the source is unavailable (non-Linux, not mounted, no
 * permission) — an expected degraded state, never thrown to the caller.
 *
 * No shell execution: these are plain file reads of kernel-exported text.
 */

const KB = 1024;

export interface MemInfo {
  totalBytes: number | null;
  freeBytes: number | null;
  availableBytes: number | null;
  buffersBytes: number | null;
  cachedBytes: number | null;
  swapTotalBytes: number | null;
  swapFreeBytes: number | null;
}

/** Parse `/proc/meminfo` (values are in kB). */
export function parseMeminfo(text: string): MemInfo {
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    const m = /^(\w+):\s+(\d+)\s*kB$/.exec(line.trim());
    if (m) {
      const [, key, val] = m;
      if (key && val) map.set(key, Number(val) * KB);
    }
  }
  const get = (k: string) => (map.has(k) ? (map.get(k) as number) : null);
  return {
    totalBytes: get("MemTotal"),
    freeBytes: get("MemFree"),
    availableBytes: get("MemAvailable"),
    buffersBytes: get("Buffers"),
    cachedBytes: get("Cached"),
    swapTotalBytes: get("SwapTotal"),
    swapFreeBytes: get("SwapFree"),
  };
}

export async function readMeminfo(): Promise<MemInfo | null> {
  try {
    return parseMeminfo(await readFile("/proc/meminfo", "utf8"));
  } catch {
    return null;
  }
}

export interface NetDevRow {
  name: string;
  rxBytes: number;
  rxErrors: number;
  rxDropped: number;
  txBytes: number;
  txErrors: number;
  txDropped: number;
}

/** Parse `/proc/net/dev`. Skips the loopback interface. */
export function parseNetDev(text: string): NetDevRow[] {
  const rows: NetDevRow[] = [];
  const lines = text.trim().split("\n").slice(2); // drop the 2 header lines
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    if (!name || name === "lo") continue;
    const cols = line
      .slice(idx + 1)
      .trim()
      .split(/\s+/)
      .map(Number);
    // RX: bytes packets errs drop ... (0..3); TX: bytes packets errs drop (8..11)
    rows.push({
      name,
      rxBytes: cols[0] ?? 0,
      rxErrors: cols[2] ?? 0,
      rxDropped: cols[3] ?? 0,
      txBytes: cols[8] ?? 0,
      txErrors: cols[10] ?? 0,
      txDropped: cols[11] ?? 0,
    });
  }
  return rows;
}

export async function readNetDev(): Promise<NetDevRow[] | null> {
  try {
    return parseNetDev(await readFile("/proc/net/dev", "utf8"));
  } catch {
    return null;
  }
}

/** Real, on-disk filesystem types we surface as storage pools (excludes
 * pseudo/virtual mounts like proc, sysfs, tmpfs, overlay, cgroup). */
export const REAL_FSTYPES: ReadonlySet<string> = new Set([
  "ext2",
  "ext3",
  "ext4",
  "xfs",
  "btrfs",
  "zfs",
  "f2fs",
  "jfs",
  "reiserfs",
  "vfat",
  "exfat",
  "ntfs",
  "ntfs3",
  "fuseblk",
]);

export interface MountRow {
  device: string;
  mountpoint: string;
  fstype: string;
}

/** Single-file config bind-mounts the container runtime injects. These carry a
 * *real* fstype (the host's ext4/xfs etc.), so the {@link REAL_FSTYPES} allowlist
 * cannot exclude them — they must be filtered by mountpoint. They are never user
 * storage and must not appear as filesystems/pools. */
const INTERNAL_MOUNTPOINTS: ReadonlySet<string> = new Set([
  "/etc/resolv.conf",
  "/etc/hosts",
  "/etc/hostname",
  "/dev/termination-log",
]);

/** Mountpoint prefixes for runtime/pseudo locations that are never user storage,
 * even when a bind-mount gives them a real fstype. */
const INTERNAL_MOUNT_PREFIXES: readonly string[] = ["/proc/", "/sys/", "/dev/", "/run/", "/var/run/"];

/** True for container/host internal mounts that should never be shown as storage. */
export function isInternalMount(mountpoint: string): boolean {
  if (INTERNAL_MOUNTPOINTS.has(mountpoint)) return true;
  return INTERNAL_MOUNT_PREFIXES.some((p) => mountpoint.startsWith(p));
}

/** Parse `/proc/mounts`, keeping only real, user-facing filesystems: real fstypes
 * only, container/internal bind-mounts dropped, de-duped by mountpoint. */
export function parseMounts(text: string): MountRow[] {
  const seen = new Set<string>();
  const rows: MountRow[] = [];
  for (const line of text.split("\n")) {
    const [device, rawMount, fstype] = line.split(/\s+/);
    if (!device || !rawMount || !fstype) continue;
    if (!REAL_FSTYPES.has(fstype)) continue;
    // octal-escape decode for spaces etc. in the mountpoint (\040 -> space)
    const mountpoint = rawMount.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
    if (isInternalMount(mountpoint)) continue;
    if (seen.has(mountpoint)) continue;
    seen.add(mountpoint);
    rows.push({ device, mountpoint, fstype });
  }
  return rows;
}

/**
 * Pick the mountpoint that most specifically holds the app's data directory, used
 * to label it as app/container storage rather than NAS/pool storage. Returns the
 * longest mountpoint that contains `appDataDir`, ignoring root (`/`) — data merely
 * living on the root filesystem is not a distinct "app data volume". `null` when
 * the data dir is not on any dedicated mount.
 */
export function pickAppDataMount(mountpoints: readonly string[], appDataDir: string): string | null {
  let best: string | null = null;
  for (const mp of mountpoints) {
    if (mp === "/") continue;
    const prefix = mp.endsWith("/") ? mp : `${mp}/`;
    if (appDataDir === mp || appDataDir.startsWith(prefix)) {
      if (!best || mp.length > best.length) best = mp;
    }
  }
  return best;
}

export async function readMounts(): Promise<MountRow[] | null> {
  try {
    return parseMounts(await readFile("/proc/mounts", "utf8"));
  } catch {
    return null;
  }
}
