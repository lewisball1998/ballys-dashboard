import type { ApiResponse, CustomIconDTO, ListResult } from "@/lib/types";
import { apiRequest } from "./api-client";

/** Typed, React-free client functions for the custom-icon endpoints. */

export function fetchCustomIcons() {
  return apiRequest<ListResult<CustomIconDTO>>("/api/icons");
}

export function deleteCustomIcon(id: string) {
  return apiRequest<{ id: string }>(`/api/icons/${id}`, { method: "DELETE" });
}

/**
 * Upload an icon file as multipart/form-data. Note: we do NOT go through
 * apiRequest here because it forces a JSON content-type — the browser must set
 * the multipart boundary itself. Still resolves to the shared ApiResponse envelope.
 */
export async function uploadCustomIcon(file: File): Promise<ApiResponse<CustomIconDTO>> {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/icons", { method: "POST", body });
    const json: unknown = await res.json().catch(() => null);
    if (json && typeof json === "object" && "ok" in json) {
      return json as ApiResponse<CustomIconDTO>;
    }
    return {
      ok: false,
      error: { code: "network_error", message: `Upload failed (${res.status})` },
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
