/**
 * Dashboard layout DTOs and config model. ⭐ ARCHITECT-OWNED.
 *
 * The dashboard homepage is a *versioned layout document* (`DashboardLayoutConfig`)
 * persisted server-side, then resolved against the server widget catalog into a
 * render-ready `DashboardLayoutDTO`. The persisted config carries only stable keys
 * (widgetKey, size token, order, hidden); titles / component bindings / column
 * widths are joined in from the catalog at resolve time so they always track the
 * contributing module definitions.
 *
 * Sections are first-class in the model from day one (widgets always live inside a
 * section) so adding multi-section UI later needs no config migration. v0.2.2 ships
 * a single default section; the framework already validates and round-trips N
 * named sections. Templates and import/export are represented in the data model
 * only — no UI in v0.2.2 (see docs/adr/0011).
 */

/** User-facing widget width tokens (width only — no height resizing in v0.2.2). */
export type WidgetSizeToken = "small" | "medium" | "wide" | "full";

// --- Persisted layout document ------------------------------------------------

/** A placed widget inside a section. Hidden widgets stay in the document so they
 *  are always recoverable (show/hide toggles `hidden`, never removes the entry). */
export interface PlacedWidget {
  /** Stable instance id, e.g. "core:system-overview". Unique within a layout. */
  id: string;
  /** Catalog key == the contributing WidgetDefinition.id. */
  widgetKey: string;
  hidden: boolean;
  size: WidgetSizeToken;
  /** Order within the owning section (normalised to 0..n-1 on save). */
  order: number;
  /** Reserved per-instance config (unused in v0.2.2). */
  config?: Record<string, unknown>;
}

/** A simple named group of widgets. No nesting / colours / icons / permissions. */
export interface LayoutSection {
  id: string;
  title: string;
  order: number;
  widgets: PlacedWidget[];
}

/** The persisted, versioned layout document. */
export interface DashboardLayoutConfig {
  version: number;
  sections: LayoutSection[];
}

// --- Widget catalog (available widgets, derived from enabled modules) ---------

export interface WidgetCatalogEntry {
  /** Owning module id ("core" for built-ins). */
  moduleId: string;
  /** Stable catalog key (== WidgetDefinition.id). */
  widgetKey: string;
  /** Maps to a concrete client component in the widget registry. */
  componentKey: string;
  title: string;
  defaultSize: WidgetSizeToken;
  description?: string;
}

// --- Templates (data-model only; no picker UI in v0.2.2) ----------------------

export interface LayoutTemplate {
  id: string;
  name: string;
  description?: string;
  config: DashboardLayoutConfig;
}

/** Portable envelope for future layout import/export (data-model only). */
export interface LayoutExport {
  kind: "ballys-dashboard-layout";
  version: number;
  config: DashboardLayoutConfig;
}

// --- Resolved, render-ready DTO (what GET returns; the grid consumes) ---------

export interface ResolvedWidget {
  id: string;
  widgetKey: string;
  componentKey: string;
  title: string;
  size: WidgetSizeToken;
  /** Grid columns for `size` (1..4); convenience for the grid. */
  columns: number;
  hidden: boolean;
  order: number;
  config: Record<string, unknown>;
}

export interface ResolvedSection {
  id: string;
  title: string;
  order: number;
  widgets: ResolvedWidget[];
}

export interface DashboardLayoutDTO {
  version: number;
  sections: ResolvedSection[];
}
