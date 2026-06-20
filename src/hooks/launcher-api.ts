import type { AppDTO, AppHealthResultDTO, CategoryDTO, ListResult } from "@/lib/types";
import type {
  AppCreateInput,
  AppLifecycleActionInput,
  AppReorderInput,
  AppUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
} from "@/lib/validation";
import { apiRequest } from "./api-client";

/** Typed, React-free client functions for the launcher endpoints. */

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

// Categories
export function fetchCategories() {
  return apiRequest<ListResult<CategoryDTO>>("/api/categories");
}
export function createCategory(input: CategoryCreateInput) {
  return apiRequest<CategoryDTO>("/api/categories", json(input));
}
export function updateCategory(id: number, input: CategoryUpdateInput) {
  return apiRequest<CategoryDTO>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export function deleteCategory(id: number) {
  return apiRequest<{ id: number }>(`/api/categories/${id}`, { method: "DELETE" });
}
export function reorderCategories(ids: number[]) {
  return apiRequest<ListResult<CategoryDTO>>("/api/categories/reorder", json({ ids }));
}

// Apps
export function fetchApps(params: { lifecycle?: string; includeHidden?: boolean } = {}) {
  const q = new URLSearchParams();
  if (params.lifecycle) q.set("lifecycle", params.lifecycle);
  if (params.includeHidden !== undefined) q.set("includeHidden", String(params.includeHidden));
  const qs = q.toString();
  return apiRequest<ListResult<AppDTO>>(`/api/apps${qs ? `?${qs}` : ""}`);
}
export function createApp(input: AppCreateInput) {
  return apiRequest<AppDTO>("/api/apps", json(input));
}
export function updateApp(id: number, input: AppUpdateInput) {
  return apiRequest<AppDTO>(`/api/apps/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export function deleteApp(id: number) {
  return apiRequest<{ id: number }>(`/api/apps/${id}`, { method: "DELETE" });
}
export function reorderApps(input: AppReorderInput) {
  return apiRequest<ListResult<AppDTO>>("/api/apps/reorder", json(input));
}
export function setFavourite(id: number, isFavourite: boolean) {
  return apiRequest<AppDTO>(`/api/apps/${id}/favourite`, json({ isFavourite }));
}
export function lifecycleAction(id: number, action: AppLifecycleActionInput["action"]) {
  return apiRequest<AppDTO>(`/api/apps/${id}/lifecycle`, json({ action }));
}
export function checkHealth(id: number) {
  return apiRequest<AppHealthResultDTO>(`/api/apps/${id}/health/check`, { method: "POST" });
}
