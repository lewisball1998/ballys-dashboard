/**
 * App icon library types (v0.2.6). ⭐ Pure, transport-safe — imported by both the
 * client (picker, AppIcon) and the server (validation). No React, no Node.
 *
 * Icons are referenced from the existing `apps.icon` TEXT column as a typed
 * *reference string* (see resolve.ts for the grammar) — no apps-table change.
 */

/** Explicit, user-selectable variants. Theme (light/dark) is resolved at render. */
export type IconVariant = "light" | "dark" | "4k" | "alt";

/** Resolved render theme (used to pick a theme variant when one is declared). */
export type IconTheme = "light" | "dark";

/** A first-party built-in icon shipped in the repo (public/icons/builtin). */
export interface BuiltinIcon {
  /** Stable id used in `builtin:<key>` references. */
  key: string;
  /** Human label shown in the picker. */
  label: string;
  /** Base asset filename under public/icons/builtin/. */
  file: string;
  /**
   * Monochrome glyph rendered with `currentColor` (CSS mask) so it adapts to the
   * active theme automatically. Our initial curated set is all monochrome. A
   * future full-colour brand icon would set this false and render via <img>.
   */
  monochrome: boolean;
  /** Lowercased name/url tokens used for auto-suggestion. */
  aliases: string[];
  /** Optional explicit/theme variants → filename. Reserved for later packs. */
  variants?: Partial<Record<IconVariant, string>>;
}

/** Parsed form of an `apps.icon` reference string. */
export type ParsedIconRef =
  | { kind: "none" }
  | { kind: "url"; url: string }
  | { kind: "builtin"; key: string; variant: IconVariant | null }
  | { kind: "custom"; id: string }
  | {
      kind: "pack";
      /** Imported pack slug (`icon_packs.id`). */
      packId: string;
      /** Icon key within the pack (`icon_pack_icons.key`). */
      iconKey: string;
      /** Optional manifest-declared variant slug (free-form, not {@link IconVariant}). */
      variant: string | null;
    }
  | { kind: "legacy"; value: string };

/** Output of the resolver — how AppIcon should render the icon. */
export type ResolvedIcon =
  | { mode: "img"; src: string }
  | { mode: "mask"; src: string }
  | { mode: "initials" };
