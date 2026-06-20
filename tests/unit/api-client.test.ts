import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/hooks/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest envelope handling", () => {
  it("returns the parsed success envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { x: 1 } }), { status: 200 })),
    );
    const res = await apiRequest<{ x: number }>("/api/test");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.x).toBe(1);
  });

  it("passes a server error envelope through unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: { code: "validation_error", message: "bad", fields: { theme: ["nope"] } },
            }),
            { status: 400 },
          ),
      ),
    );
    const res = await apiRequest("/api/test", { method: "PATCH", body: "{}" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("validation_error");
      expect(res.error.fields?.theme).toEqual(["nope"]);
    }
  });

  it("maps a non-envelope response to network_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ foo: 1 }), { status: 500 })),
    );
    const res = await apiRequest("/api/test");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("network_error");
  });

  it("maps a thrown fetch to network_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const res = await apiRequest("/api/test");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("boom");
  });
});
