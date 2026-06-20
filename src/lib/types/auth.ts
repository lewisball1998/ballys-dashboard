/**
 * Auth DTOs. ⭐ ARCHITECT-OWNED (additive, ratified Phase 5). Single-user admin
 * auth — no multi-user/RBAC. No secrets (password hash / session token) are ever
 * exposed in DTOs.
 */
export interface AuthStatusDTO {
  /** The `authEnabled` setting. */
  authEnabled: boolean;
  /** A valid session is present on this request. */
  authenticated: boolean;
  /** authEnabled but no admin user exists yet (bootstrap state). */
  needsAdmin: boolean;
  /** The signed-in admin username when authenticated. */
  username: string | null;
}
