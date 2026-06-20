import type { ApiResponse } from "@/lib/types";

/**
 * Thin client for the API's shared `ApiResponse` envelope. React-free so it is
 * unit-testable in a node environment. Always resolves to an envelope — network
 * / parse failures become an `ok: false` with code "network_error".
 */
export async function apiRequest<T>(input: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const json: unknown = await res.json().catch(() => null);
    if (json && typeof json === "object" && "ok" in json) {
      return json as ApiResponse<T>;
    }
    return {
      ok: false,
      error: { code: "network_error", message: `Request failed (${res.status})` },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}
