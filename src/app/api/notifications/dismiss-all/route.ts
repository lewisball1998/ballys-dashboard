import { protectedRoute, jsonOk } from "@/server/api/respond";
import { dismissAll } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export const PATCH = protectedRoute(async () => jsonOk({ updated: dismissAll() }));
