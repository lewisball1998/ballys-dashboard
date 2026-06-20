import { z } from "zod";
import { settingsUpdateSchema } from "./settings";

/**
 * Setup wizard request schemas. ⭐ ARCHITECT-OWNED (additive, see types/setup).
 */

/** Admin credentials set during setup (enables auth). */
export const setupAdminSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(8).max(256),
});

/**
 * POST /api/setup/complete — optionally apply final settings + configure auth,
 * then mark complete. `auth` is either admin credentials (enables auth) or an
 * explicit skip (disables auth). Both optional → backwards-compatible.
 */
export const setupCompleteSchema = z.object({
  settings: settingsUpdateSchema.optional(),
  auth: z.union([setupAdminSchema, z.object({ skip: z.literal(true) })]).optional(),
});

/** POST /api/setup/seed — seed generic starter categories for a template. */
export const setupSeedSchema = z.object({
  template: z.enum(["blank", "homelab"]),
});

export type SetupCompleteInput = z.infer<typeof setupCompleteSchema>;
export type SetupSeedInput = z.infer<typeof setupSeedSchema>;
