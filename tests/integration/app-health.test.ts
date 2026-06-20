import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the health probe so we can assert checkApp goes THROUGH it (never makes
// real network calls) and maps probe results/errors onto persisted health rows.
vi.mock("@/server/http/health-probe", () => {
  class HealthProbeError extends Error {
    reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? reason);
      this.reason = reason;
      this.name = "HealthProbeError";
    }
  }
  return { HealthProbeError, probeHealth: vi.fn() };
});

import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, categories } from "@/db/schema";
import { HealthProbeError, probeHealth } from "@/server/http/health-probe";
import { createApp } from "@/server/services/apps";
import { checkAppById, getHistory, getLatestHealth, getStats } from "@/server/services/app-health";

const mockProbe = vi.mocked(probeHealth);

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(categories).run();
  mockProbe.mockReset();
});

describe("app health checks", () => {
  it("persists an 'up' result via the health probe", async () => {
    mockProbe.mockResolvedValue({ status: 200, durationMs: 7 });
    const app = createApp({ name: "svc", url: "https://svc.test" });

    const result = await checkAppById(app.id);
    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(mockProbe.mock.calls[0]?.[0]).toBe("https://svc.test");
    expect(result?.status).toBe("up");
    expect(result?.statusCode).toBe(200);
    expect(result?.latencyMs).toBe(7);
    expect(getLatestHealth(app.id)?.status).toBe("up");
  });

  it("maps 4xx to degraded and 5xx to down", async () => {
    const a = createApp({ name: "a", url: "https://a.test" });
    mockProbe.mockResolvedValue({ status: 404, durationMs: 1 });
    expect((await checkAppById(a.id))?.status).toBe("degraded");
    mockProbe.mockResolvedValue({ status: 500, durationMs: 1 });
    expect((await checkAppById(a.id))?.status).toBe("down");
  });

  it("falls back to url, and prefers healthUrl when set", async () => {
    mockProbe.mockResolvedValue({ status: 200, durationMs: 1 });
    const a = createApp({ name: "a", url: "https://a.test" });
    await checkAppById(a.id);
    expect(mockProbe.mock.calls[0]?.[0]).toBe("https://a.test");

    mockProbe.mockClear();
    const b = createApp({ name: "b", url: "https://b.test", healthUrl: "https://b.test/health" });
    await checkAppById(b.id);
    expect(mockProbe.mock.calls[0]?.[0]).toBe("https://b.test/health");
  });

  it("passes the per-app self-signed TLS option through to the probe", async () => {
    mockProbe.mockResolvedValue({ status: 200, durationMs: 1 });
    const insecure = createApp({ name: "i", url: "https://i.test", healthInsecureTls: true });
    await checkAppById(insecure.id);
    expect(mockProbe.mock.calls[0]?.[1]).toMatchObject({ allowInsecureTls: true });

    mockProbe.mockClear();
    const secure = createApp({ name: "s", url: "https://s.test" });
    await checkAppById(secure.id);
    expect(mockProbe.mock.calls[0]?.[1]).toMatchObject({ allowInsecureTls: false });
  });

  it("records 'down' with a safe reason when the probe throws", async () => {
    mockProbe.mockRejectedValue(new HealthProbeError("self_signed", "Self-signed certificate"));
    const a = createApp({ name: "a", url: "https://a.test" });
    const result = await checkAppById(a.id);
    expect(result?.status).toBe("down");
    expect(result?.message).toBe("Self-signed certificate");
  });

  it("returns null for an unknown app", async () => {
    expect(await checkAppById(99_999)).toBeNull();
  });

  it("computes uptime stats and history from persisted results", async () => {
    const a = createApp({ name: "a", url: "https://a.test" });
    mockProbe.mockResolvedValue({ status: 200, durationMs: 1 });
    await checkAppById(a.id);
    await checkAppById(a.id);
    mockProbe.mockResolvedValue({ status: 500, durationMs: 1 });
    await checkAppById(a.id);

    const stats = getStats(a.id, 24);
    expect(stats.status).toBe("down"); // latest
    expect(stats.uptimePercent).toBeCloseTo(66.7, 1); // 2 of 3 up
    expect(getHistory(a.id, 24, 10)).toHaveLength(3);
  });
});
