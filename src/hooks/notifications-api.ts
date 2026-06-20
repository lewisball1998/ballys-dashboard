import type { ListResult, NotificationCountsDTO, NotificationDTO } from "@/lib/types";
import { apiRequest } from "./api-client";

/** React-free client functions for the notification endpoints. */

export function fetchNotifications(query = "") {
  return apiRequest<ListResult<NotificationDTO>>(`/api/notifications${query ? `?${query}` : ""}`);
}
export function fetchCounts() {
  return apiRequest<NotificationCountsDTO>("/api/notifications/counts");
}
export function markRead(id: number) {
  return apiRequest<NotificationDTO>(`/api/notifications/${id}/read`, { method: "PATCH" });
}
export function dismiss(id: number) {
  return apiRequest<NotificationDTO>(`/api/notifications/${id}/dismiss`, { method: "PATCH" });
}
export function markAllRead() {
  return apiRequest<{ updated: number }>("/api/notifications/read-all", { method: "PATCH" });
}
export function dismissAll() {
  return apiRequest<{ updated: number }>("/api/notifications/dismiss-all", { method: "PATCH" });
}
export function clearDismissed() {
  return apiRequest<{ deleted: number }>("/api/notifications/dismissed", { method: "DELETE" });
}
