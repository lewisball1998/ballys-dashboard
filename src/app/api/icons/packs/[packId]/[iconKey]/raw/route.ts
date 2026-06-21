import { NextResponse } from "next/server";
import { protectedRoute, jsonError, parseBody } from "@/server/api/respond";
import { packIconRawParamSchema } from "@/lib/validation";
import { isValidPackVariant } from "@/lib/icons/resolve";
import { getPackIconBytes } from "@/server/services/icon-packs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ packId: string; iconKey: string }> };

/**
 * Serve an imported pack icon's bytes by (packId, key[, ?v=variant]). Same safe
 * headers as custom icons: nosniff, inline, immutable. Only PNG/WebP are ever
 * stored, so no SVG is served. A missing pack/icon (or absent variant with no
 * base) is a 404 → the client falls back to initials.
 */
export const GET = protectedRoute<Ctx>(async (req, ctx) => {
  const res = parseBody(packIconRawParamSchema, await ctx.params);
  if (!res.success) return res.response;

  const rawVariant = new URL(req.url).searchParams.get("v");
  const variant = rawVariant && isValidPackVariant(rawVariant) ? rawVariant : null;

  const found = getPackIconBytes(res.data.packId, res.data.iconKey, variant);
  if (!found) return jsonError("not_found", "Icon not found", 404);

  const body = new Blob([Uint8Array.from(found.bytes)], { type: found.mime });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": found.mime,
      "Content-Length": String(found.bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
