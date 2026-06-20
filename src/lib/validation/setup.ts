import { z } from "zod";
import { settingsUpdateSchema } from "./settings";

/**
 * Setup wizard request schemas. ⭐ ARCHITECT-OWNED (additive, see types/setup).
 */

/** POST /api/setup/complete — optionally apply final settings, then mark complete. */
export const setupCompleteSchema = z.object({
  settings: settingsUpdateSchema.optional(),
});

/** POST /api/setup/seed — seed generic starter categories for a template. */
export const setupSeedSchema = z.object({
  template: z.enum(["blank", "homelab"]),
});

export type SetupCompleteInput = z.infer<typeof setupCompleteSchema>;
export type SetupSeedInput = z.infer<typeof setupSeedSchema>;
