import { protectedRoute, jsonOk, jsonError } from "@/server/api/respond";
import type { CustomIconDTO, ListResult } from "@/lib/types";
import { MAX_ICON_BYTES, sniffImageType } from "@/lib/icons/upload";
import { createCustomIcon, listCustomIcons } from "@/server/services/custom-icons";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  const items = listCustomIcons();
  const body: ListResult<CustomIconDTO> = { items, total: items.length };
  return jsonOk(body);
});

/**
 * Upload a custom icon (multipart/form-data, field `file`). Safety:
 *  - hard size cap (MAX_ICON_BYTES)
 *  - type decided by MAGIC BYTES, never the client-declared content-type
 *  - PNG/WebP only (user SVG is rejected — see ADR 0013)
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
  if (file.size > MAX_ICON_BYTES) {
    return jsonError(
      "file_too_large",
      `Icon exceeds the ${Math.floor(MAX_ICON_BYTES / 1024)} KB limit`,
      400,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    return jsonError("unsupported_type", "Only PNG and WebP icons are supported", 400);
  }

  return jsonOk(createCustomIcon(bytes, type), 201);
});
