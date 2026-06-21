import { protectedRoute, jsonOk, jsonError } from "@/server/api/respond";
import type { IconPackDTO, ListResult } from "@/lib/types";
import { MAX_PACK_ZIP_BYTES } from "@/lib/icons/pack-manifest";
import { importIconPack, listIconPacks } from "@/server/services/icon-packs";
import { PackImportError } from "@/server/icons/pack-import";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  const items = listIconPacks();
  const body: ListResult<IconPackDTO> = { items, total: items.length };
  return jsonOk(body);
});

/**
 * Import a local icon pack (multipart/form-data, field `file` = a `.zip`).
 * Local upload only — no remote URLs. All archive/manifest/asset validation
 * lives in the importer; failures map to a specific error code (and 409 for a
 * duplicate pack id).
 */
export const POST = protectedRoute(async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("invalid_form", "Expected multipart/form-data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return jsonError("validation_error", "Missing 'file' upload", 400);
  }
  if (file.size === 0) {
    return jsonError("validation_error", "Uploaded file is empty", 400);
  }
  if (file.size > MAX_PACK_ZIP_BYTES) {
    return jsonError(
      "pack_too_large",
      `Pack exceeds the ${Math.floor(MAX_PACK_ZIP_BYTES / 1024 / 1024)} MB limit`,
      400,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // The uploaded filename seeds the pack id/name for a manifestless flat zip.
  const zipName = file instanceof File && typeof file.name === "string" ? file.name : undefined;
  try {
    return jsonOk(importIconPack(bytes, zipName), 201);
  } catch (error) {
    if (error instanceof PackImportError) return jsonError(error.code, error.message, error.status);
    throw error;
  }
});
