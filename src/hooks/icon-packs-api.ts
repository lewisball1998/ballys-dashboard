import type { ApiResponse, IconPackDTO, ListResult, PackMatchApplyResultDTO } from "@/lib/types";
import type { PackMatchApplyInput } from "@/lib/validation";
import { apiRequest } from "./api-client";

/** Typed, React-free client functions for the icon-pack endpoints (v0.2.8). */

export function fetchIconPacks() {
  return apiRequest<ListResult<IconPackDTO>>("/api/icons/packs");
}

export function deleteIconPack(id: string) {
  return apiRequest<{ id: string }>(`/api/icons/packs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Bulk-apply vetted pack-icon → app assignments (v0.2.9 Icon Pack App Matching). */
export function applyPackMatches(packId: string, input: PackMatchApplyInput) {
  return apiRequest<PackMatchApplyResultDTO>(
    `/api/icons/packs/${encodeURIComponent(packId)}/apply`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/**
 * Import a `.zip` pack as multipart/form-data. As with custom-icon upload we do
 * NOT use apiRequest (it forces a JSON content-type — the browser must set the
 * multipart boundary). Still resolves to the shared ApiResponse envelope.
 */
export async function importIconPack(file: File): Promise<ApiResponse<IconPackDTO>> {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/icons/packs", { method: "POST", body });
    const json: unknown = await res.json().catch(() => null);
    if (json && typeof json === "object" && "ok" in json) {
      return json as ApiResponse<IconPackDTO>;
    }
    return {
      ok: false,
      error: { code: "network_error", message: `Import failed (${res.status})` },
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
