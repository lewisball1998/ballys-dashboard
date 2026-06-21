import { protectedRoute, jsonOk } from "@/server/api/respond";
import { resetLayout } from "@/server/services/dashboard-layout";

export const dynamic = "force-dynamic";

export const POST = protectedRoute(async () => {
  return jsonOk(resetLayout());
});
