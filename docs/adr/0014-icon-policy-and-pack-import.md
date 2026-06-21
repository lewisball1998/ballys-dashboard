# 0014 — Icon coverage policy & future icon-pack import

**Status:** Accepted · 2026-06-21

## Context
v0.2.6 (ADR 0013) shipped a small first-party generic icon library, typed
`apps.icon` references, a shared `AppIcon` renderer, and PNG/WebP custom uploads
(SVG blocked). With only 16 generic keys and sparse aliases, most common
self-hosted apps fell back to initials or mis-mapped. A parallel research pass
(see `docs/plans/v0.2.7-icon-pack-research-alias-expansion-plan.md`) catalogued
~180 apps and reviewed third-party icon-pack licensing. v0.2.7 acts on that
research: it grows coverage **without** any DB, Docker, or auth change, and it
records the policy for what may/may not be bundled and how a future user-driven
icon-pack import should work.

## Decision

### Coverage (implemented in v0.2.7)
- **Grow the first-party generic registry from 16 → 30 keys.** New generic glyphs
  (authored, monochrome, currentColor-mask): `ai`, `proxy`, `identity`,
  `automation`, `camera`, `backup`, `notes`, `finance`, `rss`, `server`,
  `indexer`, `calendar`, `search`, `requests`. No third-party brand logos.
- **Expand aliases** across existing + new keys to cover the catalogued P1/P2
  apps. Alias rules: normalized lowercase-alphanumeric; each alias lives on
  exactly one key (no duplicates — duplicates would tie and resolve by registry
  order); avoid aliases < 3 chars unless exact-match safe.
- **Re-home two existing alias groups** so suggestions match expectations:
  uptime/uptimekuma/netdata/monitoring moved `chart` → `monitor`; overseerr/
  jellyseerr moved `media` → the new `requests` key.
- **4K / multi-instance: a qualifier-stripping pre-pass in `suggestIconKey`.**
  Standalone qualifier tokens (`4k, uhd, hd, sd, 1080p, 2160p, fhd, anime, kids,
  remux, x265, hevc, instance, main, alt, secondary, 2, 3`) are dropped (token-
  based, whole words only) before matching, so `Sonarr 4K`/`Radarr Anime`/
  `Sonarr 2` → `media`. **Never strips to empty** (a bare `4K`/`Anime` keeps its
  tokens). `suggestIconKey` stays **pure and returns only a base key** — it never
  emits `?v=4k`; variant decoration, if ever added, belongs to the picker/caller.
- **Short-name bleed guard:** the weakest match signal (alias-contains-name) now
  requires a residual name of ≥ 3 chars, so `HD`/`AI`-style short residuals don't
  bleed into long aliases.
- **No schema/migration, no Docker/auth, no resolver/AppIcon change** — new
  monochrome keys render through the existing mask path automatically.

### Licensing policy (copyright ≠ trademark)
A permissive copyright license on an icon file (MIT/Apache/CC-BY/CC0) governs the
*artwork* only; it grants **no trademark rights**, and the licensor usually does
not own the depicted mark. Therefore:
- **Bundle only first-party generic glyphs** (status quo). Generic OSS glyph sets
  (Lucide ISC, Tabler MIT, MDI/Pictogrammers Apache-2.0) *could* be bundled
  safely with license text retained, but we author first-party for visual
  cohesion — bundling them is **not** done in v0.2.7.
- **Never bundle brand-logo packs** (selfh.st/icons CC-BY, homarr-labs/
  dashboard-icons Apache-2.0, simple-icons CC0). They are permissively
  *copyrighted* but are predominantly **trademarks**; a user labelling their own
  app instance is nominative fair use, whereas a product redistributing a curated
  logo library in its distributed artifact is the risky act. Brand icons are
  **user-provided only** (existing custom upload today; future import below).

### Future icon-pack import (NOT implemented in v0.2.7 — design of record)
A later phase may add an **opt-in, user-driven** icon-pack import, treated as
untrusted user input:
- **Grammar:** add `pack:<packId>/<key>` (and `?v=<variant>`) alongside the
  existing `builtin:`/`custom:`/URL refs; falls through `parseIconRef` safely
  (back-compatible). Pack icons resolve to `mode:"img"` only (never mask).
- **Manifest:** a `manifest.json` (`manifestVersion:1`) with strict-slug pack
  `id` and per-icon `key`, `label`, `aliases`, `file` (assets/-rooted, no `..`),
  advisory `mime`, `variants`, and display-only `license`/`attribution`.
- **Validation:** archive/entry/uncompressed caps (zip-bomb guard); zod manifest
  schema; per-asset **magic-byte sniffing** (reuse `sniffImageType`, PNG/WebP
  only — type decided by bytes, not declared `mime`); 512 KB/asset; sha256 dedup;
  path-traversal rejection; atomic staged import.
- **Storage:** files on the data volume under `<ICONS_DIR>/packs/<packId>/` (by
  sha256) + an `icon_packs` metadata table; served by opaque `(packId,key)` →
  `/api/icons/packs/.../raw` with the v0.2.6 safe headers.
- **SVG stays blocked** for imported packs until a reviewed server-side sanitiser
  (DOMPurify-in-jsdom or allowlist parser) + its own ADR land.
- **Sources:** local `.zip` upload first (no SSRF surface); URL-fetch only later,
  strictly through the existing `guardedFetch()` chokepoint (ADR 0006) with
  `privateNetwork:"block"`.

## Consequences
- v0.2.7 is code + first-party assets + tests + docs only: no migration, no
  Docker/deployment/auth change, no third-party assets, no SVG uploads, no
  `pack:` grammar yet. Existing `builtin:`/`custom:`/URL/initials refs render
  unchanged.
- Auto-suggestions now cover the bulk of common homelab apps, with deterministic
  tie-breaks and qualifier-insensitive matching for multi-instance setups.
- The licensing stance is documented: the product ships zero brand marks; users
  supply brand icons themselves. The import design is captured so a future phase
  can implement it without re-deriving the threat model.
