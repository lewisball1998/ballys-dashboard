# 0015 — User icon-pack import (as built)

**Status:** Accepted · 2026-06-21

Implements the "Future icon-pack import" design of record from
[ADR 0014](0014-icon-policy-and-pack-import.md) (which that ADR explicitly
deferred). This ADR records what v0.2.8 actually shipped.

## Context
v0.2.6 (ADR 0013) gave apps a typed `apps.icon` reference (`builtin:`/`custom:`/
URL/initials), PNG/WebP custom uploads with SVG blocked, a `custom_icons` table,
and data-volume file storage. v0.2.7 (ADR 0014) expanded first-party generic
glyphs and recorded the policy that **brand icons are user-provided only** — the
product bundles zero brand marks. The remaining gap: users with their own curated
icon sets had to upload icons one at a time. v0.2.8 lets a user import a whole
**local `.zip` pack** at once, while treating the archive as fully untrusted
input.

## Decision

### Scope and non-goals
- **User-imported local `.zip` packs only.** No bundled third-party icon packs
  (selfh.st/icons, homarr-labs/dashboard-icons, simple-icons, Lucide, Tabler,
  MDI, …), no brand logos committed to the repo, **no remote/URL importing** (no
  SSRF surface this phase), and no icon marketplace/registry.
- **PNG/WebP only; SVG stays rejected** for imported packs until a reviewed
  server-side sanitiser lands under its own ADR (unchanged from ADR 0013/0014).
- No Docker/deployment change; no auth/multi-user change. Reuses the existing
  `protectedRoute` (auth + same-origin CSRF) and the `ICONS_DIR`/data-volume model.

### Reference grammar
Adds `pack:<packId>/<iconKey>` (and `pack:<packId>/<iconKey>?v=<variant>`) to the
`apps.icon` grammar, parsed additively in `parseIconRef` after `builtin:`/`custom:`
and before the legacy fallthrough — back-compatible, no apps-table change
(`apps.icon` is still validated only as bounded text).
- `packId` / `iconKey` are slugs: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 64 chars.
- `variant` is a free-form slug (≤ 32 chars), distinct from the fixed built-in
  `IconVariant` union — packs declare their own variant names.
- **Resolution:** pack icons always resolve to `mode:"img"` (never CSS mask),
  served from `/api/icons/packs/<packId>/<iconKey>/raw` (+ `?v=` when present and
  slug-valid). `resolveIconSrc` is pure/DB-free: it only builds the URL and
  validates slugs; existence is enforced by the route (404) with the shared
  `AppIcon` `onError` → initials. An invalid variant slug is dropped → base icon.

### Manifest (`manifest.json`, `manifestVersion: 1`)
zod-validated; the file is the only allowed root entry besides `assets/`:
- `manifestVersion` (literal `1`), `id` (slug, becomes the on-disk dir + `pack:` id),
  `name`, `version`; optional `author`, `license`, and `homepage`
  (**http(s) only, display/link only — never fetched**).
- `icons[]`: `key` (slug, **unique within the pack**), optional `label`, `file`
  (an `assets/`-rooted safe path), and optional `variants` (variant slug → safe
  `assets/` path).
- A safe asset path must start with `assets/`, contain no `..` segment, no
  absolute/leading `/`, no backslash, no Windows drive letter, no NUL byte, and
  each segment matches `[A-Za-z0-9._-]+`.

### `fflate` dependency decision
The project shipped no ZIP parser and Node's `zlib` provides only raw DEFLATE, not
a ZIP container reader. Hand-rolling a full parser for untrusted input is its own
risk surface, so v0.2.8 adds **`fflate`** (MIT, ~8 KB, zero runtime dependencies,
widely used) as the archive reader. Its `unzipSync` `filter` hook exposes each
entry's name and **declared** uncompressed size *before* decompression, which is
used to skip oversized/disallowed entries. A small hand-written central-directory
scan complements it for entry-count bounding and symlink detection (below), which
`fflate` does not surface.

### ZIP safety model (untrusted archive)
Cheapest checks first; inflation last:
1. **Total zip-size cap** (5 MB) before any parsing.
2. **Central-directory scan**: bounds entry count (≤ 600; the zip64 `0xffff`
   entry-count sentinel exceeds this and is rejected) and rejects **symlinks /
   non-regular, non-directory nodes** via the Unix `st_mode` in the high 16 bits of
   each entry's external attributes (when the archive's host-OS byte is Unix).
3. **`fflate` `filter`**: allowlist `manifest.json` (root) + `assets/**` only —
   any other entry rejects the whole import; per-entry and running **declared**
   uncompressed caps (per-asset 512 KB, total 16 MB) reject before inflation
   (zip-bomb guard); directory entries skipped.
4. **Manifest** parse (`malformed_manifest` on bad JSON) + zod validation
   (`invalid_manifest`).
5. Nested zips/other archives are rejected by effect (their bytes never sniff as
   PNG/WebP) and by the `assets/`-only allowlist; a referenced file missing from
   the archive is rejected (`missing_file`).

### Asset validation model
For every referenced `file`/variant, against the **actual inflated bytes**:
- **Magic-byte sniffing** decides the type (reusing `sniffImageType`) — PNG/WebP
  only; SVG, GIF, JPEG, ICO, empty, and malformed assets are rejected. The
  declared manifest `mime` is advisory and never trusted.
- Per-asset 512 KB cap and a running 16 MB total (declared **and** actual both
  validated, so a lying declared size cannot slip a bomb through).
- sha256 dedup: the stored filename is `<sha256>.<ext>`; multiple keys/variants may
  share one file.

### Storage model
Files live on the existing data volume under
`<ICONS_DIR>/packs/<packId>/<sha256>.<ext>` (no new env var — `ICONS_DIR` already
covers it). **A filesystem path is never exposed to the client.** Import is
**atomic**: assets are written to a throwaway staging dir on the same volume, then
`rename`d into place; metadata rows are written in a single transaction; any
failure removes the staged files and persists nothing.

### Database
Two additive tables (one migration, `0004`):
- **`icon_packs`** — `id` (slug PK), `name`, `version`, `author?`, `license?`,
  `homepage?`, `manifest_version`, `icon_count`, `bytes`, `created_at`.
- **`icon_pack_icons`** — `pack_id` (FK → `icon_packs.id` `ON DELETE cascade`),
  `key`, `label?`, `variant` (NULL = base), `sha256`, `ext`, `mime`, `bytes`;
  unique `(pack_id, key, variant)`, indexes on `(pack_id, key)` and `sha256`.

A normalised child table (vs. a JSON column) was chosen because the serve path
resolves `(packId, key[, variant]) → file` on every icon render — an indexed
lookup beats parsing a JSON blob per request — and it gives per-icon integrity,
dedup, and clean cascade delete, mirroring the `custom_icons` precedent. No change
to `apps` or `custom_icons`.

### API and serving
All under `/api/icons/packs`, all `protectedRoute` (auth + same-origin CSRF):
- `GET /api/icons/packs` — list packs (+ their icons) for the picker.
- `POST /api/icons/packs` — multipart `.zip` import; specific error codes
  (`pack_too_large`, `invalid_manifest`, `unsupported_type`, `too_many_entries`,
  `unsafe_entry`, `uncompressed_too_large`, …); **duplicate pack id → `409`
  `duplicate_pack`** (re-import is delete-first).
- `DELETE /api/icons/packs/[packId]` — removes rows (cascade) + on-disk files.
- `GET /api/icons/packs/[packId]/[iconKey]/raw` (+ optional `?v=`) — serves bytes
  by `(packId, key[, variant])` with the **same safe headers as custom icons**:
  `Content-Type` from the stored mime, `X-Content-Type-Options: nosniff`,
  `Content-Disposition: inline`, `Cache-Control: public, max-age=31536000,
  immutable`. Only PNG/WebP are ever stored, so no SVG is served.

### Fallback behaviour
- Missing/deleted pack, missing icon key, or a stored file gone → serve route 404
  → `AppIcon` `onError` → **initials**.
- Requested variant absent → **base icon**; base also absent → initials.
- Invalid `pack:` slug in a stored ref → initials at parse/resolve time (no request).
- Deleting a pack **does not rewrite app records**; apps referencing it degrade to
  initials until the pack is re-imported.

## Consequences
- v0.2.8 is code + one additive migration + tests + docs; no third-party assets,
  no brand logos, no SVG, no remote fetching, no Docker/deployment/auth change.
  Existing `builtin:`/`custom:`/URL/legacy/initials refs render unchanged.
- The product still ships zero brand marks; users supply brand icons themselves —
  now in bulk via packs, with attribution/licence shown in the picker.
- ADR 0014's "Future icon-pack import" section is now realised by this ADR.

### Deferred (future phases)
- **v0.2.9 — Icon Pack App Matching (bulk icon-to-app assignment).** Explicitly
  **not** in v0.2.8. After a pack is imported, a later phase may add a
  review/matching UI that **suggests** matches between existing apps and imported
  icon keys, shows a confidence/reason per suggestion where useful, lets the user
  tick/untick and manually adjust suggestions, and **bulk-applies only the
  selected assignments after explicit confirmation**. Icons are **never
  auto-applied without user approval**. v0.2.8's manual, one-at-a-time selection
  from the Packs tab is unaffected and remains the shipped behaviour.
- **Pack-driven suggestions** — manifest `aliases` feeding `suggestIconKey` (kept
  built-in-only this phase to avoid tie-break complexity). Likely folds into the
  v0.2.9 matching work.
- **Pack replace/upgrade flow** — in-place re-import (today a duplicate id is
  rejected; replacing means delete-then-import).
- **URL-fetched packs** — only ever via the `guardedFetch()` SSRF chokepoint
  (ADR 0006) with private-network blocking, under its own ADR.
- **SVG packs** — only after a reviewed server-side sanitiser lands (ADR 0013/0014).
