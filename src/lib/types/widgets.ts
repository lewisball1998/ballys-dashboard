/**
 * Dashboard widget DTOs. ⭐ ARCHITECT-OWNED.
 *
 * A `DashboardWidgetDTO` is a *placed* widget on the dashboard. It references a
 * module's `WidgetDefinition` (src/modules/types.ts) via `componentKey`, which
 * the Frontend maps to a concrete client component.
 *
 * In v0.1 the layout is a read-only default derived from enabled modules (no
 * drag/resize — that is v0.3). The mutation schema in lib/validation/widgets
 * exists for forward-compatibility and is intentionally NOT wired to an endpoint
 * yet.
 */
export interface WidgetSize {
  w: number;
  h: number;
}

export interface DashboardWidgetDTO {
  /** Stable instance id; in v0.1 derived as `${moduleId}:${widgetId}`. */
  id: string;
  /** Owning module ("core" in v0.1). */
  moduleId: string;
  /** The contributing WidgetDefinition.id. */
  widgetId: string;
  /** Maps to a client component in the Frontend widget registry. */
  componentKey: string;
  title: string;
  size: WidgetSize;
  order: number;
  config: Record<string, unknown>;
}

export interface DashboardLayoutDTO {
  widgets: DashboardWidgetDTO[];
}
