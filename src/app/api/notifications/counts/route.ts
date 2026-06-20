import { route, jsonOk } from "@/server/api/respond";
import { getCounts } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export const GET = route(async () => jsonOk(getCounts()));
