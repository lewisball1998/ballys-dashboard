import { route, jsonOk, parseJson } from "@/server/api/respond";
import { setupCompleteSchema } from "@/lib/validation";
import { completeSetup } from "@/server/services/setup";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const parsed = await parseJson(req, setupCompleteSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(completeSetup(parsed.data.settings));
});
