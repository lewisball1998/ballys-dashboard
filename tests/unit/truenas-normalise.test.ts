import { describe, it, expect } from "vitest";
import {
  flattenDatasets,
  indexRootDatasets,
  indexSmartResults,
  mapSmartStatus,
  nasSeverity,
  normaliseDatasets,
  normaliseDisks,
  normalisePools,
  normaliseSmartTime,
  parseCapacity,
  poolStatusSeverity,
} from "@/server/telemetry/truenas/normalise";
import type { RawDataset, RawDisk, RawPool, RawSmartResult } from "@/server/telemetry/truenas/types";

describe("parseCapacity", () => {
  it("accepts numbers, numeric strings and { parsed } / { rawvalue } wrappers", () => {
    expect(parseCapacity(1024)).toBe(1024);
    expect(parseCapacity("2048")).toBe(2048);
    expect(parseCapacity({ parsed: 4096 })).toBe(4096);
    expect(parseCapacity({ parsed: "8192" })).toBe(8192);
    expect(parseCapacity({ rawvalue: "16384" })).toBe(16384);
  });

  it("collapses missing / negative / non-finite to null", () => {
    expect(parseCapacity(null)).toBeNull();
    expect(parseCapacity(undefined)).toBeNull();
    expect(parseCapacity(-1)).toBeNull();
    expect(parseCapacity("nope")).toBeNull();
    expect(parseCapacity({ parsed: null })).toBeNull();
    expect(parseCapacity({})).toBeNull();
  });
});

describe("poolStatusSeverity", () => {
  it("maps healthy / degraded / faulted statuses", () => {
    expect(poolStatusSeverity("ONLINE", true)).toBe("healthy");
    expect(poolStatusSeverity("online", null)).toBe("healthy");
    expect(poolStatusSeverity("DEGRADED", null)).toBe("warning");
    expect(poolStatusSeverity("OFFLINE", null)).toBe("warning");
    expect(poolStatusSeverity("FAULTED", null)).toBe("critical");
    expect(poolStatusSeverity("UNAVAIL", null)).toBe("critical");
  });

  it("treats ONLINE-but-unhealthy as a warning, not critical", () => {
    expect(poolStatusSeverity("ONLINE", false)).toBe("warning");
  });

  it("uses the healthy flag when status is missing, else unavailable", () => {
    expect(poolStatusSeverity(null, true)).toBe("healthy");
    expect(poolStatusSeverity(null, false)).toBe("warning");
    expect(poolStatusSeverity(null, null)).toBe("unavailable");
    expect(poolStatusSeverity("", null)).toBe("unavailable");
  });
});

describe("mapSmartStatus", () => {
  it("maps passed / failing and treats unknown/in-progress as unavailable (never failing)", () => {
    expect(mapSmartStatus("PASSED")).toBe("passed");
    expect(mapSmartStatus("SUCCESS")).toBe("passed");
    expect(mapSmartStatus("FAILED")).toBe("failing");
    expect(mapSmartStatus("FAILING")).toBe("failing");
    expect(mapSmartStatus("RUNNING")).toBe("unavailable");
    expect(mapSmartStatus(undefined)).toBe("unavailable");
    expect(mapSmartStatus(42)).toBe("unavailable");
  });
});

describe("flattenDatasets / indexRootDatasets", () => {
  const tree: RawDataset[] = [
    {
      id: "tank",
      name: "tank",
      used: { parsed: 100 },
      available: { parsed: 300 },
      children: [
        { id: "tank/media", name: "tank/media", used: { parsed: 60 }, available: { parsed: 300 } },
        { id: "tank/apps", name: "tank/apps", used: { parsed: 40 }, available: { parsed: 300 } },
      ],
    },
  ];

  it("flattens nested children", () => {
    expect(flattenDatasets(tree).map((d) => d.id)).toEqual(["tank", "tank/media", "tank/apps"]);
  });

  it("indexes only pool roots (ids without a slash)", () => {
    const idx = indexRootDatasets(tree);
    expect(idx.get("tank")).toEqual({ used: 100, available: 300 });
    expect(idx.has("tank/media")).toBe(false);
  });
});

describe("normalisePools", () => {
  it("uses pool-object capacity when present", () => {
    const pools: RawPool[] = [
      { name: "fast", status: "ONLINE", healthy: true, size: 1000, allocated: 250, free: 750 },
    ];
    const [p] = normalisePools(pools);
    expect(p).toMatchObject({
      name: "fast",
      severity: "healthy",
      health: "ONLINE",
      totalBytes: 1000,
      usedBytes: 250,
      freeBytes: 750,
      usagePercent: 25,
    });
  });

  it("back-fills capacity from the root dataset when the pool omits it", () => {
    const pools: RawPool[] = [{ name: "tank", status: "ONLINE", healthy: true }];
    const datasets: RawDataset[] = [
      { id: "tank", name: "tank", used: { parsed: 100 }, available: { parsed: 300 } },
    ];
    const [p] = normalisePools(pools, datasets);
    expect(p).toMatchObject({ totalBytes: 400, usedBytes: 100, freeBytes: 300, usagePercent: 25 });
  });

  it("skips entries without a name and carries severity through", () => {
    const pools: RawPool[] = [{ status: "ONLINE" }, { name: "bad", status: "DEGRADED" }];
    const out = normalisePools(pools);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "bad", severity: "warning" });
  });
});

describe("normaliseDatasets", () => {
  const tree: RawDataset[] = [
    {
      id: "tank",
      name: "tank",
      used: { parsed: 100 },
      available: { parsed: 300 },
      children: [
        {
          id: "tank/media",
          name: "tank/media",
          mountpoint: "/mnt/tank/media",
          used: { parsed: 60 },
          available: { parsed: 40 },
        },
        { id: "tank/apps", name: "tank/apps", used: { parsed: 10 }, available: { parsed: 90 } },
      ],
    },
  ];

  it("skips pool roots, sorts by used desc, and computes capacity", () => {
    const out = normaliseDatasets(tree);
    expect(out.map((d) => d.name)).toEqual(["tank/media", "tank/apps"]);
    expect(out[0]).toMatchObject({
      name: "tank/media",
      usedBytes: 60,
      availableBytes: 40,
      totalBytes: 100,
      usagePercent: 60,
    });
  });

  it("never surfaces a host mountpoint, only the dataset label", () => {
    const json = JSON.stringify(normaliseDatasets(tree));
    expect(json).not.toContain("/mnt/");
  });

  it("respects the max cap", () => {
    const many: RawDataset[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tank/d${i}`,
      name: `tank/d${i}`,
      used: { parsed: i },
      available: { parsed: 1 },
    }));
    expect(normaliseDatasets(many, 10)).toHaveLength(10);
  });
});

describe("dataset dedupe — live TrueNAS shape (top-level + nested duplicates)", () => {
  // Reproduces the live pool.dataset.query shape from QA: each dataset appears
  // BOTH nested under its parent's `children` AND repeated at the top level, so a
  // naive flatten counts "tank/media" 2x and "tank/media/movies" 3x.
  const liveShape: RawDataset[] = [
    {
      id: "tank",
      name: "tank",
      used: { parsed: 100 },
      available: { parsed: 300 },
      children: [
        {
          id: "tank/media",
          name: "tank/media",
          used: { parsed: 60 },
          available: { parsed: 40 },
          children: [
            { id: "tank/media/movies", name: "tank/media/movies", used: { parsed: 30 }, available: { parsed: 40 } },
          ],
        },
      ],
    },
    // same dataset repeated at the top level, again carrying its own children
    {
      id: "tank/media",
      name: "tank/media",
      used: { parsed: 60 },
      available: { parsed: 40 },
      children: [
        { id: "tank/media/movies", name: "tank/media/movies", used: { parsed: 30 }, available: { parsed: 40 } },
      ],
    },
    // and the leaf repeated at the top level too
    { id: "tank/media/movies", name: "tank/media/movies", used: { parsed: 30 }, available: { parsed: 40 } },
  ];

  it("flattenDatasets returns each dataset exactly once (deduped by id)", () => {
    const flat = flattenDatasets(liveShape);
    const ids = flat.map((d) => d.id);
    expect(ids).toEqual(["tank", "tank/media", "tank/media/movies"]);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it("normaliseDatasets yields unique datasets only (root skipped)", () => {
    const out = normaliseDatasets(liveShape);
    const names = out.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(["tank/media", "tank/media/movies"]);
    expect(out[0]).toMatchObject({ name: "tank/media", usedBytes: 60, usagePercent: 60 });
  });

  it("falls back to name when id is absent, and preserves a genuinely nested-only child", () => {
    const noIds: RawDataset[] = [
      {
        name: "vol",
        used: { parsed: 10 },
        available: { parsed: 90 },
        children: [{ name: "vol/data", used: { parsed: 5 }, available: { parsed: 5 } }],
      },
      // duplicate of "vol" by name (no id); its nested child is unique
      { name: "vol", used: { parsed: 10 }, available: { parsed: 90 } },
    ];
    const flat = flattenDatasets(noIds);
    expect(flat.map((d) => d.name)).toEqual(["vol", "vol/data"]);
  });
});

describe("indexSmartResults / normaliseSmartTime", () => {
  it("takes the latest test status + time per disk", () => {
    const results: RawSmartResult[] = [
      {
        disk: "sda",
        tests: [
          { status: "SUCCESS", datetime: { $date: 1_700_000_000_000 } },
          { status: "FAILED", datetime: { $date: 1_700_000_500_000 } },
        ],
      },
    ];
    const idx = indexSmartResults(results);
    expect(idx.sda?.status).toBe("failing");
    expect(idx.sda?.lastCheck).toBe(new Date(1_700_000_500_000).toISOString());
  });

  it("parses epoch seconds, epoch ms, ISO strings and rejects garbage", () => {
    expect(normaliseSmartTime(1_700_000_000)).toBe(new Date(1_700_000_000_000).toISOString());
    expect(normaliseSmartTime(1_700_000_000_000)).toBe(new Date(1_700_000_000_000).toISOString());
    expect(normaliseSmartTime("2024-01-01T00:00:00.000Z")).toBe("2024-01-01T00:00:00.000Z");
    expect(normaliseSmartTime("not a date")).toBeNull();
    expect(normaliseSmartTime(null)).toBeNull();
  });
});

describe("normaliseDisks", () => {
  const disks: RawDisk[] = [
    {
      name: "sda",
      model: "WDC WD40EFRX",
      serial: "WD-WCC4E1234567",
      size: 4_000_787_030_016,
      type: "HDD",
      rotationrate: 5400,
    },
    { name: "nvme0n1", model: "Samsung 970", serial: "S1234567890", size: 500_000_000_000, type: "SSD" },
  ];

  it("normalises model/type/size/temperature and SMART (sorted by name)", () => {
    const temps = { sda: 42, nvme0n1: 33 };
    const smart = indexSmartResults([
      { disk: "sda", tests: [{ status: "SUCCESS", datetime: { $date: 1_700_000_000_000 } }] },
    ]);
    const out = normaliseDisks(disks, temps, smart);
    const sda = out.find((d) => d.name === "sda");
    const nvme = out.find((d) => d.name === "nvme0n1");
    expect(sda).toMatchObject({
      model: "WDC WD40EFRX",
      type: "hdd",
      sizeBytes: 4_000_787_030_016,
      temperatureC: 42,
      temperatureSeverity: "healthy",
      smartStatus: "passed",
    });
    expect(nvme).toMatchObject({ type: "nvme", smartStatus: "unavailable" });
  });

  it("masks serials — the full serial is never present", () => {
    const out = normaliseDisks(disks);
    expect(out.find((d) => d.name === "sda")?.serial).toBe("WD…4567");
    expect(JSON.stringify(out)).not.toContain("WCC4E1234567");
    expect(JSON.stringify(out)).not.toContain("S1234567890");
  });

  it("treats a missing temperature as unavailable, not a fault", () => {
    const [d] = normaliseDisks([{ name: "sdb", model: "x" }]);
    expect(d?.temperatureC).toBeNull();
    expect(d?.temperatureSeverity).toBe("unavailable");
    expect(d?.smartStatus).toBe("unavailable");
  });
});

describe("nasSeverity", () => {
  it("rolls up the worst of pool / temperature / SMART signals", () => {
    expect(nasSeverity([], [])).toBe("unavailable");
    expect(
      nasSeverity(
        [{ name: "a", severity: "healthy", health: "ONLINE", usedBytes: 1, freeBytes: 1, totalBytes: 2, usagePercent: 50 }],
        [],
      ),
    ).toBe("healthy");
    const failingDisk = normaliseDisks([{ name: "sda", model: "x" }])[0]!;
    failingDisk.smartStatus = "failing";
    expect(
      nasSeverity(
        [{ name: "a", severity: "warning", health: "DEGRADED", usedBytes: null, freeBytes: null, totalBytes: null, usagePercent: null }],
        [failingDisk],
      ),
    ).toBe("critical");
  });
});
