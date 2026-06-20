/**
 * App launcher DTOs. ⭐ ARCHITECT-OWNED. Mirrors the `apps` table.
 *
 * Lifecycle is three orthogonal axes (see db/schema/apps.ts): `isHidden`
 * (display), `healthEnabled` (functional/"disabled"), `lifecycle`
 * (active|retired). The launcher exposes them via lifecycle actions below.
 */
import type { AppHealthResultDTO } from "./health";

export const APP_LIFECYCLE = ["active", "retired"] as const;
export type AppLifecycle = (typeof APP_LIFECYCLE)[number];

/** UI actions that map onto the three lifecycle axes. */
export const APP_LIFECYCLE_ACTIONS = [
  "hide",
  "unhide",
  "enable-health",
  "disable-health",
  "retire",
  "restore",
] as const;
export type AppLifecycleAction = (typeof APP_LIFECYCLE_ACTIONS)[number];

export interface AppDTO {
  id: number;
  categoryId: number | null;
  name: string;
  url: string;
  icon: string | null;
  description: string | null;
  openNewTab: boolean;
  isFavourite: boolean;
  authRequired: boolean;
  /** When null, health checks (if enabled) fall back to `url`. */
  healthUrl: string | null;
  healthEnabled: boolean;
  /**
   * Trusted-internal escape hatch: skip TLS verification for this app's health
   * check only (e.g. a NAS with a self-signed cert). Secure verification is the
   * default; this never affects other apps or global TLS.
   */
  healthInsecureTls: boolean;
  isHidden: boolean;
  lifecycle: AppLifecycle;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Latest health result; included by list/detail responses when present. */
  latestHealth: AppHealthResultDTO | null;
}
