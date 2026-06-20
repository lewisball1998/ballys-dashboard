import { route, jsonOk } from "@/server/api/respond";
import { markAllRead } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export const PATCH = route(async () => jsonOk({ updated: markAllRead() }));
