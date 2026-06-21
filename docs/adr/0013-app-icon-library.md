# 0013 — App icon library & custom icons

**Status:** Accepted · 2026-06-21

## Context
Apps previously stored a single free-text `apps.icon` value that was rendered
directly as `<img src>` in three places (launcher card, Quick Launch, individual
app widget), with an initials fallback. With apps now appearing as standalone
dashboard widgets, icons matter more. We want a built-in icon library, optional
user-uploaded icons, and theme-aware rendering — without hard-coding anything,
without bundling third-party brand assets (licensing/safety unresolved), and
without breaking existing icon URLs.

## Decision
- **`apps.icon` becomes a typed reference string — no apps-table change.** Grammar:
  `null/""` → initials; `http(s)://…` → remote URL (unchanged); `builtin:<key>`
  (and `builtin:<key>?v=<variant>`) → built-in registry icon; `custom:<id>` →
  uploaded icon; any other non-empty value → legacy raw value used as-is
  (back-compat). A single pure `resolveIconSrc()` interprets it. Theme variants
  (light/dark) are resolved at render time and never stored; explicit variants
  (4k/alt) are stored in the ref.
- **First-party generic glyphs only.** The starter registry is ~16 curated,
  *function* glyphs we authored (not brand logos), shipped as monochrome SVGs in
  `public/icons/builtin/` and rendered via CSS `mask` in `currentColor` so they
  adapt to the theme. The registry carries `aliases` that drive name→icon
  suggestion. The set is intentionally small (framework first), and variant
  fields exist so later packs slot in without re-architecting.
- **Shared `AppIcon` component.** The three render sites now delegate to one
  component: URL/custom → `<img>` (with `onError` → initials), built-in
  monochrome → masked glyph, otherwise initials. One place for resolution,
  theming and fallback.
- **Custom uploads: PNG/WebP only, files on the data volume, served by opaque id.**
  A new `custom_icons` metadata table maps an opaque id → stored file
  (mime/ext/bytes/sha256). The image bytes live in an `icons/` dir next to the
  SQLite file (one volume; `ICONS_DIR` overrides), keeping the DB lean. Bytes are
  served at `/api/icons/:id/raw` by id only — a filesystem path is never exposed.
  Identical uploads dedupe by sha256.
- **Upload safety.** Type is decided by **magic bytes**, not the client-declared
  content-type; size is hard-capped at 512 KB; responses set
  `X-Content-Type-Options: nosniff`, inline disposition and immutable caching.
- **User SVG is deferred.** Uploaded SVG can carry script/external refs and a
  safe sanitiser was out of scope for this phase, so user SVG is rejected.
  Built-in SVGs are first-party, reviewed repo assets and are safe to ship.
- **Auto-suggest is non-destructive.** A pure `suggestIconKey(name, url?)` offers
  a built-in based on the app name/URL; it is only ever *offered* in the picker
  and never overwrites an explicit user choice (suggestion shows only when the
  icon is empty).

## Consequences
- No change to the apps table, the apps API contract, or Docker/deployment. One
  additive migration (`custom_icons`).
- Existing icon URLs keep rendering unchanged; empty/unknown refs fall back to
  initials, as does a dead URL or a deleted custom icon (`onError`).
- The backup target becomes the whole data dir (icons sit beside the DB file),
  documented in `.env.example`.
- The framework generalises: larger first-party sets, theme/4k variants, and
  (post-licensing) optional community packs can be added later without touching
  app records or the renderer. User-SVG support can be added once a reviewed
  sanitiser lands.
