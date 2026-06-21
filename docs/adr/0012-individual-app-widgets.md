# 0012 — Individual app dashboard widgets

**Status:** Accepted · 2026-06-21

## Context
v0.2.2/v0.2.3 gave the homepage a customisable layout (show/hide, reorder,
resize, sections, save/cancel/reset). Apps still only appeared collectively in
the Quick Launch widget. Users want to pin a *specific* app as its own homepage
widget, working with the existing editor, without hard-coding anything and
without the dashboard breaking when an app is later hidden, retired or deleted.

The layout framework (ADR 0011) drives two invariants that shape the design: the
widget **catalog** (derived from enabled modules) is the source of truth for
"known" widgets, and reconcile **drops** any widget whose `widgetKey` is not in
the catalog while **auto-appending** any catalog widget missing from the saved
document. A naive "one catalog entry per app" approach would therefore force
every app onto every dashboard — the opposite of what we want.

## Decision
- **One generic, instanceable `app` widget.** A single `WidgetDefinition`
  (`id`/`componentKey` = `"app"`) is contributed by the **core** module. The
  user adds it 0..N times; each instance binds to an app via `config.appId`. The
  persisted instance is `{ id: "app:<appId>", widgetKey: "app", config: { appId } }` —
  `appId` is the only per-instance state stored, so the app name never goes stale
  (it is resolved fresh on every load).
- **`instanceable` flag on the widget contract.** Added to `WidgetDefinition`,
  `WidgetCatalogEntry` and `ResolvedWidget`. Instanceable widgets are *templates*:
  they are **known** to the catalog (so instances survive reconcile) but are
  **never auto-placed** — excluded from the default layout and from reconcile's
  auto-append. Built-in singletons leave the flag falsy and behave exactly as
  before.
- **Missing apps are a render concern, not a reconcile concern.** Reconcile keeps
  app instances whose `appId` is structurally valid and only drops *malformed*
  ones (missing / non-positive-integer `appId`). A deleted/retired app is never
  silently removed from the layout; the client renders a calm unavailable/retired
  state and the editor offers Remove.
- **Strict `config.appId` validation.** The layout schema requires a positive
  integer `config.appId` when `widgetKey === "app"`; reconcile drops anything that
  still slips through (hand-edited/corrupt documents).
- **Server resolves the title; `resolveLayout` stays pure.** `resolveLayout`
  continues to join only catalog metadata. The DB-aware layout service enriches
  app-widget titles from the apps table afterwards (app name, or "Unavailable
  app" fallback), keeping the pure resolver and its tests intact.
- **Editor add/remove; one widget per app.** The editor gains an "Add an app
  widget" area (pick an app — active apps, hidden included, retired excluded —
  plus a target section). Already-added apps are disabled. Adding only mutates the
  draft; nothing persists until Save. Instanceable widgets gain a **Remove**
  action, distinct from Hide (Hide keeps the instance; Remove deletes it).
- **Shared client cache.** App widgets read app/category data from a single
  `AppsCacheProvider` mounted by the grid only when an app widget is visible, so
  many app widgets share one fetch and app-widget-free dashboards pay nothing.

## Consequences
- No DB schema, migration, API contract, or route changes — app widgets ride the
  existing `dashboard_layouts` document and `GET`/`PUT`/`POST reset` endpoints.
- Default and Reset layouts contain no app widgets; no app is ever auto-added.
- A deleted/retired/missing app degrades to a safe placeholder rather than
  crashing the homepage.
- `instanceable` generalises beyond apps: future "add many" widgets (e.g. a saved
  chart, a single container) can reuse the same template/instance mechanism.
