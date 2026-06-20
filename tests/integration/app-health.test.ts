import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the guarded fetch wrapper so we can assert checkApp goes THROUGH it
// (never bypasses) without making real network calls.
vi.mock("@/server/http/guarded-fetch", () => {
  class GuardedFetchError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
  return { GuardedFetchError, guardedFetch: vi.fn() };
});

import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, categories } from "@/db/schema";
import { guardedFetch, GuardedFetchError, type GuardedResponse } from "@/server/http/guarded-fetch";
import { createApp } from "@/server/services/apps";
import { checkAppById, getHistory, getLatestHealth, getStats } from "@/server/services/app-health";

const mockFetch = vi.mocked(guardedFetch);

function fakeRes(status: number, durationMs = 1): GuardedResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    url: "https://svc.test",
    headers: new Headers(),
    body: Buffer.alloc(0),
    bytes: 0,
    durationMs,
  };
}

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(categories).run();
  mockFetch.mockReset();
});

describe("app health checks", () => {
  it("persists an 'up' result via the guarded fetch wrapper", async () => {
    mockFetch.mockResolvedValue(fakeRes(200, 7));
    const app = createApp({ name: "svc", url: "https://svc.test" });

    const result = await checkAppById(app.id);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toBe("https://svc.test");
    expect(result?.status).toBe("up");
    expect(result?.statusCode).toBe(200);
    expect(result?.latencyMs).toBe(7);
    expect(getLatestHealth(app.id)?.status).toBe("up");
  });

  it("maps 4xx to degraded and 5xx to down", async () => {
    const a = createApp({ name: "a", url: "https://a.test" });
    mockFetch.mockResolvedValue(fakeRes(404));
    expect((await checkAppById(a.id))?.status).toBe("degraded");
    mockFetch.mockResolvedValue(fakeRes(500));
    expect((await checkAppById(a.id))?.status).toBe("down");
  });

  it("falls back to url, and prefers healthUrl when set", async () => {
    mockFetch.mockResolvedValue(fakeRes(200));
    const a = createApp({ name: "a", url: "https://a.test" });
    await checkAppById(a.id);
    expect(mockFetch.mock.calls[0]?.[0]).toBe("https://a.test");

    mockFetch.mockClear();
    const b = createApp({ name: "b", url: "https://b.test", healthUrl: "https://b.test/health" });
    await checkAppById(b.id);
    expect(mockFetch.mock.calls[0]?.[0]).toBe("https://b.test/health");
  });

  it("records 'down' when the guarded fetch throws", async () => {
    mockFetch.mockRejectedValue(new GuardedFetchError("timed out", "timeout"));
    const a = createApp({ name: "a", url: "https://a.test" });
    const result = await checkAppById(a.id);
    expect(result?.status).toBe("down");
    expect(result?.message).toContain("timeout");
  });

  it("returns null for an unknown app", async () => {
    expect(await checkAppById(99_999)).toBeNull();
  });

  it("computes uptime stats and history from persisted results", async () => {
    const a = createApp({ name: "a", url: "https://a.test" });
    mockFetch.mockResolvedValue(fakeRes(200));
    await checkAppById(a.id);
    await checkAppById(a.id);
    mockFetch.mockResolvedValue(fakeRes(500));
    await checkAppById(a.id);

    const stats = getStats(a.id, 24);
    expect(stats.status).toBe("down"); // latest
    expect(stats.uptimePercent).toBeCloseTo(66.7, 1); // 2 of 3 up
    expect(getHistory(a.id, 24, 10)).toHaveLength(3);
  });
});
