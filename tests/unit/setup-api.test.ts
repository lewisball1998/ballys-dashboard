import { afterEach, describe, expect, it, vi } from "vitest";
import { completeSetup, fetchSetupStatus, seedTemplate } from "@/hooks/setup-api";

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function stubFetch(data: unknown): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("setup api client", () => {
  it("fetchSetupStatus GETs the status endpoint", async () => {
    const calls = stubFetch({ setupCompleted: false });
    const res = await fetchSetupStatus();
    expect(res.ok).toBe(true);
    expect(calls[0]?.url).toBe("/api/setup/status");
  });

  it("seedTemplate POSTs the template", async () => {
    const calls = stubFetch({ template: "homelab", categoriesCreated: 5, categoriesSkipped: 0 });
    await seedTemplate("homelab");
    expect(calls[0]?.url).toBe("/api/setup/seed");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ template: "homelab" });
  });

  it("completeSetup POSTs the settings payload", async () => {
    const calls = stubFetch({ setupCompleted: true });
    await completeSetup({ settings: { dashboardName: "X", theme: "dark" } });
    expect(calls[0]?.url).toBe("/api/setup/complete");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ settings: { dashboardName: "X", theme: "dark" } });
  });
});
