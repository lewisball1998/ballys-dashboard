import { NextResponse } from "next/server";
import { protectedRoute, jsonError, parseBody } from "@/server/api/respond";
import { customIconIdParamSchema } from "@/lib/validation";
import { getCustomIconBytes } from "@/server/services/custom-icons";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serve a custom icon's raw bytes by opaque id. Safe headers: nosniff (no
 * content-type sniffing), inline disposition, immutable caching. Only PNG/WebP
 * are ever stored, so no SVG is served here.
 */
export const GET = protectedRoute<Ctx>(async (req, ctx) => {
  const idRes = parseBody(customIconIdParamSchema, await ctx.params);
  if (!idRes.success) return idRes.response;

  const found = getCustomIconBytes(idRes.data.id);
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
