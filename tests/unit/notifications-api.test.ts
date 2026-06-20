import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDismissed,
  dismiss,
  dismissAll,
  fetchCounts,
  fetchNotifications,
  markAllRead,
  markRead,
} from "@/hooks/notifications-api";

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

describe("notifications api client", () => {
  it("fetchNotifications appends the query when present", async () => {
    const calls = stubFetch({ items: [], total: 0 });
    const res = await fetchNotifications("limit=5&unread=true");
    expect(res.ok).toBe(true);
    expect(calls[0]?.url).toBe("/api/notifications?limit=5&unread=true");
  });

  it("fetchNotifications has no query string when empty", async () => {
    const calls = stubFetch({ items: [], total: 0 });
    await fetchNotifications();
    expect(calls[0]?.url).toBe("/api/notifications");
  });

  it("fetchCounts hits the counts endpoint", async () => {
    const calls = stubFetch({ total: 0, unread: 0 });
    await fetchCounts();
    expect(calls[0]?.url).toBe("/api/notifications/counts");
  });

  it("markRead / dismiss PATCH the item routes", async () => {
    const read = stubFetch({ id: 7 });
    await markRead(7);
    expect(read[0]?.url).toBe("/api/notifications/7/read");
    expect(read[0]?.init?.method).toBe("PATCH");
    vi.unstubAllGlobals();

    const dis = stubFetch({ id: 7 });
    await dismiss(7);
    expect(dis[0]?.url).toBe("/api/notifications/7/dismiss");
    expect(dis[0]?.init?.method).toBe("PATCH");
  });

  it("bulk actions hit the right routes/methods", async () => {
    const ra = stubFetch({ updated: 3 });
    await markAllRead();
    expect(ra[0]?.url).toBe("/api/notifications/read-all");
    expect(ra[0]?.init?.method).toBe("PATCH");
    vi.unstubAllGlobals();

    const da = stubFetch({ updated: 2 });
    await dismissAll();
    expect(da[0]?.url).toBe("/api/notifications/dismiss-all");
    expect(da[0]?.init?.method).toBe("PATCH");
    vi.unstubAllGlobals();

    const cd = stubFetch({ deleted: 4 });
    await clearDismissed();
    expect(cd[0]?.url).toBe("/api/notifications/dismissed");
    expect(cd[0]?.init?.method).toBe("DELETE");
  });
});
