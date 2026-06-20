import { route, jsonOk } from "@/server/api/respond";
import { clearDismissed } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

/** Permanently delete dismissed notifications. */
export const DELETE = route(async () => jsonOk({ deleted: clearDismissed() }));
