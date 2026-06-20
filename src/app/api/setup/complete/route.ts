import { route, jsonOk, parseJson } from "@/server/api/respond";
import { setupCompleteSchema } from "@/lib/validation";
import { completeSetup } from "@/server/services/setup";
import { requireSetupAuth } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const gate = requireSetupAuth(req);
  if (gate) return gate;
  const parsed = await parseJson(req, setupCompleteSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(completeSetup(parsed.data));
});
