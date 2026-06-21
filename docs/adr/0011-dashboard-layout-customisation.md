# 0011 — Customisable homepage dashboard framework

**Status:** Accepted · 2026-06-21

## Context
The homepage was a read-only default derived from enabled modules. v0.2.2 adds
the foundation for user customisation (show/hide, reorder, resize, reset,
save/cancel, named sections) without yet building the interactive edit UI. The
framework must stay compatible with later drag-and-drop, layout templates,
import/export, custom layouts for more pages, and possible per-user layouts.

## Decision
- **Versioned layout document.** The homepage is a single `DashboardLayoutConfig`
  document: `{ version, sections[] }`, each section `{ id, title, order, widgets[] }`,
  each placed widget `{ id, widgetKey, hidden, size, order, config? }`. The
  persisted document holds only stable keys; titles, component bindings and column
  widths are joined from the widget catalog at resolve time.
- **Sections first-class, single-section UI.** Widgets always live inside a
  section, so adding multi-section UI later needs no config migration. v0.2.2
  ships one unnamed default section; the framework validates and round-trips N
  named sections. Sections are simple groups only — no nesting, colours, icons,
  permissions, or per-section settings.
- **Width-only size tokens.** `small | medium | wide | full` map to 1–4 columns.
  The token is the stable contract; the column mapping is an internal grid detail
  that can change without a config migration. No height resizing.
- **Dedicated table, JSON document.** A `dashboard_layouts` table stores the
  document as JSON (one row per layout). v0.2.2 manages one global row
  (`kind='user-default'`, `ownerKey=NULL`). The `kind`/`name`/`ownerKey` columns
  scaffold templates and future per-user layouts without another migration.
- **Catalog-driven resolution + fallback.** The widget catalog (derived from
  enabled modules) is the single source of truth. Stored configs are validated,
  then reconciled: unknown/removed widgets dropped, new ones appended visible to
  the first section, orders normalised. Missing/corrupt/invalid documents fall
  back to the computed default; the grid still error-isolates unknown components.
- **API.** `GET`/`PUT /api/dashboard/layout` and `POST /api/dashboard/layout/reset`,
  reusing the existing same-origin (CSRF) + auth route wrappers. Hidden widgets are
  returned (not stripped) so a later editor can restore them; the renderer filters
  them out.
- **Templates & import/export — data model only.** Represented via the table
  columns and a portable, versioned document with a `migrateLayoutConfig` upgrader.
  No template picker, import/export, or drag-and-drop UI in v0.2.2.

## Consequences
- A fresh install is visually identical until a layout is saved (the default
  builder reproduces the previous homepage exactly).
- One new migration; single global layout; no multi-user/auth or Docker/deployment
  changes.
- Later phases (edit UI, drag-and-drop, templates, import/export, more pages,
  per-user) build on this model without reshaping the persisted document.
