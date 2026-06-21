# 0016 — Icon Pack App Matching

**Status:** Accepted · 2026-06-21

Realises the "v0.2.9 — Icon Pack App Matching" work
[deferred by ADR 0015](0015-user-icon-pack-import.md). After a user imports an
icon pack (v0.2.8/0.2.8.1), this phase adds a **review/matching UI** that
*suggests* which imported pack icons fit existing apps and **bulk-applies only the
user's vetted, confirmed selection**. This ADR records what v0.2.9 shipped.

## Context
v0.2.8 lets users import a local `.zip` icon pack and select pack icons one at a
time from the picker's **Packs** tab (`pack:<packId>/<iconKey>` refs on the
existing `apps.icon` column). For a user with many apps and a full pack, assigning
icons one-by-one is tedious. The gap: a way to **suggest** matches across all apps
at once — without ever changing an icon the user didn't explicitly approve.

## Decision

### Scope and non-goals
- **Suggest, review, confirm, apply.** Icons are **never auto-applied.** A
  dedicated review screen always sits between a suggestion and a write, and a
  final confirmation dialog gates the bulk apply.
- **No schema change, no migration, no new dependency.** Matching reuses the
  existing `apps.icon` reference column and pack tables; applying is an
  `apps.icon` update.
- v0.2.8's **manual, one-at-a-time Packs-tab selection is unchanged** and remains
  fully supported.
- Out of scope (unchanged from ADR 0014/0015): no manifest `aliases`, no
  remote/URL imports, no bundled packs/brand logos, no SVG, no pack
  replace/upgrade, no Docker/deployment or auth change.

### Matching engine (`src/lib/icons/pack-match.ts`)
Pure, framework-free and DB-free (so it is shared by the UI and unit-tested).
`matchPackToApps(apps, pack)` returns one suggestion per app that scores a
positive match, each with a `confidence` tier and a short human `reason`.

Scoring **reuses the built-in suggester's tiers** via the new
`src/lib/icons/match-core.ts` (normalisation, qualifier-stripping and
`scoreAlias`, extracted verbatim from `suggest.ts` — `suggestIconKey`'s behaviour
is unchanged, guarded by the existing `icon-suggest` tests):

- **high** (exact): the app's normalised, qualifier-stripped name equals the icon
  key/label (or their stripped forms). Qualifier stripping works **both ways**, so
  a `sonarr` icon matches "Sonarr 4K" and a `sonarr-4k` icon matches "Sonarr".
- **medium** (contains): the app name (or URL host) contains the icon token
  (≥ 3 chars).
- **low** (reverse-contains): the icon name contains the app name.

An app is auto-ticked **only** when the match is medium/high **and** the app has
no existing icon. `currentIsCustomised` (app already has a different explicit icon)
and `alreadySet` (app already on this exact ref) are computed so the UI can
protect and short-circuit those rows.

### Review UI (`/apps/icons`)
A dedicated page (mirroring `/apps/import`), reached primarily from the **Apps**
page header ("Match icons"), and secondarily via a post-import link in the picker's
Packs tab (`/apps/icons?pack=<id>` — navigating there leaves the open form
unsaved; it is a convenience only). Per row: an apply checkbox, app name/URL,
current-icon preview → proposed-icon preview, a confidence badge, the reason, and
a **native `<select>`** to override which pack icon is assigned. Controls: pack
selector, **Include hidden/retired** (off by default → active+visible apps only),
**Replace existing icons** (off by default → protected apps are skipped), Select
all / Clear, and Apply → confirmation dialog → per-item result summary
(applied / skipped / failed).

### API and server enforcement
`POST /api/icons/packs/[packId]/apply` — `protectedRoute` (auth + same-origin
CSRF), POST-only, zod-validated body `{ assignments: [{ appId, iconKey, variant? }],
overwriteCustomised? }`. The service `applyPackMatches(packId, input)`
re-enforces **all** safety server-side (never trusting the client):
- unknown pack → `404`;
- icon key not in the pack → item `skipped`;
- a declared variant that is absent → falls back to the **base** icon (always
  safe: a valid key always has a base row);
- app not found → item `skipped`;
- app already on the exact ref → `skipped` ("Already set");
- app with any other explicit icon → `skipped` unless `overwriteCustomised`.

It returns a **partial-success** per-item outcome summary
(`applied`/`skipped`/`failed`), mirroring the Docker import result shape — one bad
item never rolls back the rest.

### Overwrite safety model
"Never auto-apply" is enforced at three layers: the review screen, the
confirmation dialog, and the server's overwrite gate. The UI disables the checkbox
for already-set rows and for protected (existing-icon) rows unless "Replace
existing icons" is on; the server independently re-applies the same gate, so a
tampered request cannot clobber a custom icon.

## Consequences
- v0.2.9 is code + tests + docs only: **no schema change, no migration
  (`db:generate` reports "nothing to migrate"), no new dependency**, no
  Docker/deployment or auth change, no third-party assets/logos, no SVG, no remote
  fetching.
- Existing `builtin:`/`custom:`/`pack:`/URL/legacy/initials refs and the manual
  Packs-tab selection are unaffected.
- The `suggest.ts` scoring core now lives in `match-core.ts` and is shared by the
  built-in suggester and the pack matcher (single source of truth).

### Deferred (future phases)
- **Manifest `aliases` feeding matching** — still deferred (kept key/label-only to
  avoid tie-break complexity); would improve recall for non-obvious names.
- **Pack replace/upgrade flow**, **URL-fetched packs** (only via the SSRF
  chokepoint), and **SVG packs** (only after a reviewed sanitiser) remain deferred
  as recorded in ADR 0015.
