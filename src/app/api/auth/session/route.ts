import { route, jsonOk } from "@/server/api/respond";
import { getAuthStatus } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => jsonOk(getAuthStatus(req)));
