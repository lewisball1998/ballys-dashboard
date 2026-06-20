import { z } from "zod";

/** Auth request schemas. ⭐ ARCHITECT-OWNED (additive, ratified Phase 5). */

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
