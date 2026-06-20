import type { ApiError, AuthStatusDTO } from "@/lib/types";
import { loginSchema } from "@/lib/validation";

/** Pure auth UI logic (no React) so it is unit-testable in node. */

/** Dashboard gate decision from the session status. */
export type GateDecision = "loading" | "allow" | "login" | "setup";

export function gateDecision(status: AuthStatusDTO | null): GateDecision {
  if (!status) return "loading";
  if (!status.authEnabled) return "allow";
  if (status.needsAdmin) return "setup";
  if (!status.authenticated) return "login";
  return "allow";
}

/** What the /login page should render given the session status. */
export type LoginView = "loading" | "disabled" | "needs-admin" | "authenticated" | "form";

export function loginView(status: AuthStatusDTO | null): LoginView {
  if (!status) return "loading";
  if (!status.authEnabled) return "disabled";
  if (status.needsAdmin) return "needs-admin";
  if (status.authenticated) return "authenticated";
  return "form";
}

export interface LoginFormValues {
  username: string;
  password: string;
}

export type LoginErrors = Partial<Record<"username" | "password" | "form", string[]>>;

export function buildLoginPayload(v: LoginFormValues): LoginFormValues {
  return { username: v.username.trim(), password: v.password };
}

export type LoginValidateResult =
  | { success: true; data: LoginFormValues }
  | { success: false; fieldErrors: LoginErrors };

export function validateLogin(v: LoginFormValues): LoginValidateResult {
  const result = loginSchema.safeParse(buildLoginPayload(v));
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: LoginErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form") as keyof LoginErrors;
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { success: false, fieldErrors };
}

export function apiLoginErrors(error: ApiError): LoginErrors {
  return (error.fields ?? {}) as LoginErrors;
}
