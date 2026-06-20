import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkHealth,
  createApp,
  createCategory,
  deleteApp,
  fetchApps,
  lifecycleAction,
  reorderApps,
  updateApp,
} from "@/hooks/launcher-api";

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

describe("launcher api client", () => {
  it("createApp POSTs JSON to /api/apps", async () => {
    const calls = stubFetch({ id: 1 });
    const res = await createApp({ name: "a", url: "https://a.test" });
    expect(res.ok).toBe(true);
    expect(calls[0]?.url).toBe("/api/apps");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ name: "a", url: "https://a.test" });
  });

  it("updateApp PATCHes /api/apps/:id", async () => {
    const calls = stubFetch({ id: 5 });
    await updateApp(5, { name: "x" });
    expect(calls[0]?.url).toBe("/api/apps/5");
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ name: "x" });
  });

  it("reorderApps POSTs ids to /api/apps/reorder", async () => {
    const calls = stubFetch({ items: [], total: 0 });
    await reorderApps({ ids: [3, 1, 2] });
    expect(calls[0]?.url).toBe("/api/apps/reorder");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ ids: [3, 1, 2] });
  });

  it("lifecycleAction POSTs the action", async () => {
    const calls = stubFetch({ id: 7 });
    await lifecycleAction(7, "retire");
    expect(calls[0]?.url).toBe("/api/apps/7/lifecycle");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ action: "retire" });
  });

  it("checkHealth POSTs to the health/check endpoint", async () => {
    const calls = stubFetch({ id: 1, appId: 7, status: "up" });
    const res = await checkHealth(7);
    expect(res.ok).toBe(true);
    expect(calls[0]?.url).toBe("/api/apps/7/health/check");
    expect(calls[0]?.init?.method).toBe("POST");
  });

  it("fetchApps builds the query string", async () => {
    const calls = stubFetch({ items: [], total: 0 });
    await fetchApps({ lifecycle: "all", includeHidden: false });
    expect(calls[0]?.url).toContain("/api/apps?");
    expect(calls[0]?.url).toContain("lifecycle=all");
    expect(calls[0]?.url).toContain("includeHidden=false");
  });

  it("deleteApp / createCategory hit the right routes", async () => {
    const del = stubFetch({ id: 3 });
    await deleteApp(3);
    expect(del[0]?.url).toBe("/api/apps/3");
    expect(del[0]?.init?.method).toBe("DELETE");
    vi.unstubAllGlobals();

    const cat = stubFetch({ id: 1 });
    await createCategory({ name: "Media" });
    expect(cat[0]?.url).toBe("/api/categories");
    expect(cat[0]?.init?.method).toBe("POST");
  });
});
