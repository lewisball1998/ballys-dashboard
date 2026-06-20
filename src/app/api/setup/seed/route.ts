import { route, jsonOk, parseJson } from "@/server/api/respond";
import { setupSeedSchema } from "@/lib/validation";
import { seedFromTemplate } from "@/server/services/setup";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const parsed = await parseJson(req, setupSeedSchema);
  if (!parsed.success) return parsed.response;
  return jsonOk(seedFromTemplate(parsed.data.template));
});
