import type { ComponentType } from "react";
import { SystemOverviewWidget } from "./widgets/system-overview-widget";
import { AppHealthSummaryWidget } from "./widgets/app-health-summary-widget";
import { NotificationsWidget } from "./widgets/notifications-widget";
import { FavouriteAppsWidget } from "./widgets/favourite-apps-widget";

/**
 * Maps a `ResolvedWidget.componentKey` to a concrete component. Keys mirror the
 * modules' WidgetDefinition componentKeys (src/modules/*) and the server widget
 * catalog. Unknown keys render an error in the grid rather than crashing.
 */
const REGISTRY: Record<string, ComponentType> = {
  "system-overview": SystemOverviewWidget,
  "app-health-summary": AppHealthSummaryWidget,
  notifications: NotificationsWidget,
  "favourite-apps": FavouriteAppsWidget,
};

export function getWidgetComponent(componentKey: string): ComponentType | null {
  return REGISTRY[componentKey] ?? null;
}
