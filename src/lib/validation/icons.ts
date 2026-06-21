import { z } from "zod";
import { PACK_ID_RE, PACK_ICON_KEY_RE, PACK_VARIANT_RE } from "@/lib/icons/resolve";

/** Custom icon request schemas. ⭐ ARCHITECT-OWNED. */

/** `:id` route param for custom icons — opaque hex token (not a numeric id). */
export const customIconIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{8,64}$/i, "Invalid icon id"),
});

export type CustomIconIdParam = z.infer<typeof customIconIdParamSchema>;

/** `:packId` route param for imported icon packs (v0.2.8). */
export const packIdParamSchema = z.object({
  packId: z.string().trim().min(1).max(64).regex(PACK_ID_RE, "Invalid pack id"),
});

export type PackIdParam = z.infer<typeof packIdParamSchema>;

/** `:packId/:iconKey` route params for serving a pack icon (v0.2.8). */
export const packIconRawParamSchema = z.object({
  packId: z.string().trim().min(1).max(64).regex(PACK_ID_RE, "Invalid pack id"),
  iconKey: z.string().trim().min(1).max(64).regex(PACK_ICON_KEY_RE, "Invalid icon key"),
});

export type PackIconRawParam = z.infer<typeof packIconRawParamSchema>;

/**
 * Body for `POST /api/icons/packs/:packId/apply` — bulk-assign pack icons to apps
 * (v0.2.9 Icon Pack App Matching). Each assignment is a vetted (appId → iconKey)
 * pick from the review UI; the server re-validates existence and re-enforces the
 * overwrite gate, so the list is never trusted to be safe on its own.
 */
export const packMatchApplySchema = z.object({
  assignments: z
    .array(
      z.object({
        appId: z.number().int().positive(),
        iconKey: z.string().trim().min(1).max(64).regex(PACK_ICON_KEY_RE, "Invalid icon key"),
        /** Optional declared variant slug; falls back to the base icon when absent. */
        variant: z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(PACK_VARIANT_RE, "Invalid variant")
          .nullish(),
      }),
    )
    .min(1)
    .max(1000),
  /**
   * Allow replacing apps that already have an explicit (built-in/custom/URL/pack/
   * legacy) icon. Default false: protected apps are skipped unless the user opts in.
   */
  overwriteCustomised: z.boolean().optional(),
});

export type PackMatchApplyInput = z.infer<typeof packMatchApplySchema>;
