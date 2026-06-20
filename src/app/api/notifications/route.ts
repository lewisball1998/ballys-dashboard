import { route, jsonOk, parseQuery } from "@/server/api/respond";
import { notificationQuerySchema } from "@/lib/validation";
import type { ListResult, NotificationDTO } from "@/lib/types";
import { listNotifications } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const parsed = parseQuery(req.nextUrl.searchParams, notificationQuerySchema);
  if (!parsed.success) return parsed.response;
  const { items, total } = listNotifications(parsed.data);
  const body: ListResult<NotificationDTO> = { items, total };
  return jsonOk(body);
});
