import { route, jsonOk } from "@/server/api/respond";
import { getSetupStatus } from "@/server/services/setup";

export const dynamic = "force-dynamic";

export const GET = route(async () => jsonOk(getSetupStatus()));
