import { protectedRoute, jsonOk, parseJson } from "@/server/api/respond";
import { settingsUpdateSchema } from "@/lib/validation";
import { getSettings, updateSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  return jsonOk(getSettings());
});

export const PATCH = protectedRoute(async (req) => {
  const parsed = await parseJson(req, settingsUpdateSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(updateSettings(parsed.data));
});
