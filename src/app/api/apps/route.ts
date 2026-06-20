import { z } from "zod";
import { protectedRoute, jsonOk, parseJson, parseQuery } from "@/server/api/respond";
import { appCreateSchema } from "@/lib/validation";
import type { AppDTO, ListResult } from "@/lib/types";
import { createApp, listApps } from "@/server/services/apps";

export const dynamic = "force-dynamic";

// Backend-local list filter (not a request-body contract). Strings from the URL.
const listQuerySchema = z.object({
  lifecycle: z.enum(["active", "retired", "all"]).optional(),
  includeHidden: z.enum(["true", "false"]).optional(),
});

export const GET = protectedRoute(async (req) => {
  const parsed = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  if (!parsed.success) return parsed.response;

  const items = listApps({
    lifecycle: parsed.data.lifecycle ?? "active",
    includeHidden: parsed.data.includeHidden !== "false",
  });
  const body: ListResult<AppDTO> = { items, total: items.length };
  return jsonOk(body);
});

export const POST = protectedRoute(async (req) => {
  const parsed = await parseJson(req, appCreateSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(createApp(parsed.data), 201);
});
