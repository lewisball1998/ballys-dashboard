import type { ComponentType } from "react";
import type { ResolvedWidget } from "@/lib/types";
import { SystemOverviewWidget } from "./widgets/system-overview-widget";
import { AppHealthSummaryWidget } from "./widgets/app-health-summary-widget";
import { NotificationsWidget } from "./widgets/notifications-widget";
import { FavouriteAppsWidget } from "./widgets/favourite-apps-widget";
import { AppWidget } from "./widgets/app-widget";

/**
 * Props passed to every widget by the grid. Singleton built-ins ignore them and
 * self-fetch; instanceable widgets (e.g. the app widget) read `widget.config`
 * (e.g. `config.appId`) to know which entity they render.
 */
export interface WidgetProps {
  widget: ResolvedWidget;
}

/**
 * Maps a `ResolvedWidget.componentKey` to a concrete component. Keys mirror the
 * modules' WidgetDefinition componentKeys (src/modules/*) and the server widget
 * catalog. Unknown keys render an error in the grid rather than crashing.
 */
const REGISTRY: Record<string, ComponentType<WidgetProps>> = {
  "system-overview": SystemOverviewWidget,
  "app-health-summary": AppHealthSummaryWidget,
  notifications: NotificationsWidget,
  "favourite-apps": FavouriteAppsWidget,
  app: AppWidget,
};

export function getWidgetComponent(componentKey: string): ComponentType<WidgetProps> | null {
  return REGISTRY[componentKey] ?? null;
}
