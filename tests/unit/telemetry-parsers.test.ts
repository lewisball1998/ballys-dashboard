import { describe, it, expect } from "vitest";
import {
  parseMeminfo,
  parseNetDev,
  parseMounts,
  isInternalMount,
  pickAppDataMount,
} from "@/server/telemetry/proc";

const KB = 1024;

describe("parseMeminfo", () => {
  it("parses kB values into bytes", () => {
    const sample = [
      "MemTotal:       16384000 kB",
      "MemFree:         1024000 kB",
      "MemAvailable:    8192000 kB",
      "Buffers:          512000 kB",
      "Cached:          2048000 kB",
      "SwapTotal:       2097152 kB",
      "SwapFree:        1048576 kB",
    ].join("\n");
    const m = parseMeminfo(sample);
    expect(m.totalBytes).toBe(16384000 * KB);
    expect(m.availableBytes).toBe(8192000 * KB);
    expect(m.cachedBytes).toBe(2048000 * KB);
    expect(m.swapTotalBytes).toBe(2097152 * KB);
    expect(m.swapFreeBytes).toBe(1048576 * KB);
  });

  it("returns null for absent fields", () => {
    const m = parseMeminfo("MemTotal: 100 kB");
    expect(m.totalBytes).toBe(100 * KB);
    expect(m.swapTotalBytes).toBeNull();
    expect(m.availableBytes).toBeNull();
  });
});

describe("parseNetDev", () => {
  it("parses per-interface rx/tx and skips loopback", () => {
    const sample = [
      "Inter-|   Receive                                                |  Transmit",
      " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
      "    lo: 1000 100 0 0 0 0 0 0 1000 100 0 0 0 0 0 0",
      "  eth0: 67890 200 3 1 0 0 0 0 12345 100 2 4 0 0 0 0",
    ].join("\n");
    const rows = parseNetDev(sample);
    expect(rows).toHaveLength(1);
    const eth0 = rows[0]!;
    expect(eth0.name).toBe("eth0");
    expect(eth0.rxBytes).toBe(67890);
    expect(eth0.rxErrors).toBe(3);
    expect(eth0.rxDropped).toBe(1);
    expect(eth0.txBytes).toBe(12345);
    expect(eth0.txErrors).toBe(2);
    expect(eth0.txDropped).toBe(4);
  });
});

describe("parseMounts", () => {
  it("keeps real filesystems, drops pseudo mounts, dedupes by mountpoint", () => {
    const sample = [
      "proc /proc proc rw 0 0",
      "/dev/sda1 / ext4 rw 0 0",
      "tmpfs /dev/shm tmpfs rw 0 0",
      "/dev/sdb1 /mnt/tank xfs rw 0 0",
      "/dev/sda1 / ext4 rw 0 0",
    ].join("\n");
    const rows = parseMounts(sample);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.mountpoint)).toEqual(["/", "/mnt/tank"]);
    expect(rows[1]!.fstype).toBe("xfs");
  });

  it("decodes octal-escaped spaces in mountpoints", () => {
    const rows = parseMounts("/dev/sdc1 /mnt/my\\040disk ext4 rw 0 0");
    expect(rows[0]!.mountpoint).toBe("/mnt/my disk");
  });

  it("drops container/internal bind-mounts that carry a real fstype", () => {
    // resolv.conf / hosts / hostname are bind-mounted from the host and inherit a
    // real fstype, so only a mountpoint filter can exclude them.
    const sample = [
      "/dev/sda1 / ext4 rw 0 0",
      "/dev/sda1 /etc/resolv.conf ext4 rw 0 0",
      "/dev/sda1 /etc/hosts ext4 rw 0 0",
      "/dev/sda1 /etc/hostname ext4 rw 0 0",
      "/dev/sda1 /run/secrets ext4 rw 0 0",
      "/dev/sdb1 /app/data ext4 rw 0 0",
    ].join("\n");
    const rows = parseMounts(sample);
    expect(rows.map((r) => r.mountpoint)).toEqual(["/", "/app/data"]);
  });
});

describe("isInternalMount", () => {
  it("flags config-file bind-mounts and runtime/pseudo paths", () => {
    expect(isInternalMount("/etc/resolv.conf")).toBe(true);
    expect(isInternalMount("/etc/hosts")).toBe(true);
    expect(isInternalMount("/etc/hostname")).toBe(true);
    expect(isInternalMount("/proc/bus")).toBe(true);
    expect(isInternalMount("/sys/fs/cgroup")).toBe(true);
    expect(isInternalMount("/dev/shm")).toBe(true);
    expect(isInternalMount("/run/lock")).toBe(true);
    expect(isInternalMount("/var/run/docker.sock")).toBe(true);
  });

  it("does not flag real storage mountpoints", () => {
    expect(isInternalMount("/")).toBe(false);
    expect(isInternalMount("/mnt/tank")).toBe(false);
    expect(isInternalMount("/app/data")).toBe(false);
  });
});

describe("pickAppDataMount", () => {
  it("picks the most specific non-root mount holding the data dir", () => {
    expect(pickAppDataMount(["/", "/app/data"], "/app/data")).toBe("/app/data");
    expect(pickAppDataMount(["/", "/app", "/app/data"], "/app/data/sub")).toBe("/app/data");
  });

  it("returns null when the data dir is only on the root filesystem", () => {
    expect(pickAppDataMount(["/"], "/app/data")).toBeNull();
    expect(pickAppDataMount(["/", "/mnt/tank"], "/app/data")).toBeNull();
  });

  it("does not match on a shared path prefix that is not a mount boundary", () => {
    // "/app" must not match "/applications" — prefix needs a separator.
    expect(pickAppDataMount(["/", "/app"], "/applications/data")).toBeNull();
  });
});
