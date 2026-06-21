import type { WidgetSizeToken } from "@/lib/types";

/**
 * Client-safe dashboard layout constants and pure helpers. ⭐ ARCHITECT-OWNED.
 *
 * Imported by both the client grid and the server layout services, so this file
 * must stay free of server-only imports (no DB, no node:* modules).
 */

/** Current layout-config schema version (bumped when the document shape changes). */
export const CURRENT_LAYOUT_VERSION = 1;

/** The implicit default section. Empty title => rendered without a heading, so a
 *  fresh install looks exactly like the pre-v0.2.2 dashboard. */
export const DEFAULT_SECTION_ID = "main";
export const DEFAULT_SECTION_TITLE = "";

/** The user-facing width tokens (width only — no height resizing in v0.2.2). */
export const WIDGET_SIZE_TOKENS = ["small", "medium", "wide", "full"] as const;

/**
 * Catalog key (and client componentKey) of the generic, instanceable app widget
 * introduced in v0.2.4. Each instance binds to an app via `config.appId`; the
 * instance id is `app:<appId>`. Shared by the client editor/registry and the
 * server catalog/reconcile so the magic string lives in exactly one place.
 */
export const APP_WIDGET_KEY = "app";

/** Build the stable instance id for an app widget bound to `appId`. */
export function appWidgetId(appId: number): string {
  return `${APP_WIDGET_KEY}:${appId}`;
}

/** Read a valid (positive integer) appId from a widget config, else null. Used
 *  by reconcile (defensive drop), the client widget, and the editor. */
export function readAppId(config: Record<string, unknown> | undefined): number | null {
  const raw = config?.appId;
  return typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;
}

/**
 * Width token -> grid columns on the homepage's `lg:grid-cols-4` grid. The token
 * is the stable contract; this mapping is an internal detail that can change with
 * the grid (e.g. a future 12-col grid) WITHOUT a config migration.
 */
export const SIZE_TOKEN_COLUMNS: Record<WidgetSizeToken, number> = {
  small: 1,
  medium: 2,
  wide: 3,
  full: 4,
};

export function sizeTokenToColumns(token: WidgetSizeToken): number {
  return SIZE_TOKEN_COLUMNS[token] ?? SIZE_TOKEN_COLUMNS.medium;
}

/** Human-readable labels for the width tokens (UI only; the token stays the contract). */
export const SIZE_TOKEN_LABELS: Record<WidgetSizeToken, string> = {
  small: "Small",
  medium: "Medium",
  wide: "Wide",
  full: "Full",
};
