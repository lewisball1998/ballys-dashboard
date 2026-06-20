import type { AuthStatusDTO } from "@/lib/types";
import type { LoginInput } from "@/lib/validation";
import { apiRequest } from "./api-client";

/** React-free client functions for the auth endpoints. */

export function fetchSession() {
  return apiRequest<AuthStatusDTO>("/api/auth/session");
}

export function login(payload: LoginInput) {
  return apiRequest<AuthStatusDTO>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" });
}
