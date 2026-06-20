import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSession, login, logout } from "@/hooks/auth-api";

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

describe("auth api client", () => {
  it("fetchSession GETs the session endpoint", async () => {
    const calls = stubFetch({ authEnabled: true, authenticated: false, needsAdmin: false, username: null });
    const res = await fetchSession();
    expect(res.ok).toBe(true);
    expect(calls[0]?.url).toBe("/api/auth/session");
  });

  it("login POSTs credentials", async () => {
    const calls = stubFetch({ authEnabled: true, authenticated: true, needsAdmin: false, username: "admin" });
    await login({ username: "admin", password: "password123" });
    expect(calls[0]?.url).toBe("/api/auth/login");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ username: "admin", password: "password123" });
  });

  it("logout POSTs the logout endpoint", async () => {
    const calls = stubFetch({ ok: true });
    await logout();
    expect(calls[0]?.url).toBe("/api/auth/logout");
    expect(calls[0]?.init?.method).toBe("POST");
  });
});
