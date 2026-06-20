import { describe, it, expect } from "vitest";
import { collectSystemMetrics } from "@/server/system/collector";

describe("system collector", () => {
  it("returns well-formed metric points", async () => {
    const points = await collectSystemMetrics();
    expect(Array.isArray(points)).toBe(true);
    for (const p of points) {
      expect(typeof p.sourceId).toBe("string");
      expect(typeof p.metric).toBe("string");
      expect(Number.isFinite(p.value)).toBe(true);
      expect(p.recordedAt).toBeInstanceOf(Date);
    }
    // memory + uptime are always present, even on the first sample
    const ids = new Set(points.map((p) => p.sourceId));
    expect(ids.has("memory")).toBe(true);
    expect(ids.has("uptime")).toBe(true);
  });

  it("includes a bounded cpu usage_percent on the second (delta) sample", async () => {
    await collectSystemMetrics();
    // burn a little CPU + wall time so the delta is non-zero
    const end = Date.now() + 150;
    let x = 0;
    while (Date.now() < end) x += Math.random();
    void x;

    const points = await collectSystemMetrics();
    const cpu = points.find((p) => p.sourceId === "cpu" && p.metric === "usage_percent");
    expect(cpu).toBeDefined();
    expect(cpu!.value).toBeGreaterThanOrEqual(0);
    expect(cpu!.value).toBeLessThanOrEqual(100);
  });
});
