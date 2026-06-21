import { z } from "zod";
import { PACK_ID_RE, PACK_ICON_KEY_RE } from "@/lib/icons/resolve";

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
