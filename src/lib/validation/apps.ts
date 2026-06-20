import { z } from "zod";
import { urlSchema } from "./common";
import { APP_LIFECYCLE_ACTIONS } from "@/lib/types/apps";

/** App launcher request schemas. ⭐ ARCHITECT-OWNED. */

const nullableText = (max: number) => z.string().trim().max(max).nullish();

export const appCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: urlSchema,
  categoryId: z.number().int().positive().nullish(),
  icon: nullableText(512),
  description: nullableText(1000),
  openNewTab: z.boolean().optional(),
  isFavourite: z.boolean().optional(),
  authRequired: z.boolean().optional(),
  /** When omitted/null, health checks (if enabled) use `url`. */
  healthUrl: urlSchema.nullish(),
  healthEnabled: z.boolean().optional(),
  /** Per-app trusted-internal escape hatch; secure TLS stays the default. */
  healthInsecureTls: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const appUpdateSchema = appCreateSchema.partial();

/** POST /api/apps/reorder — ordered ids, optionally scoped to a category. */
export const appReorderSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  ids: z.array(z.number().int().positive()).min(1),
});

/** POST /api/apps/:id/favourite */
export const appFavouriteSchema = z.object({
  isFavourite: z.boolean(),
});

/** POST /api/apps/:id/lifecycle — hide/disable/retire (+ inverses). */
export const appLifecycleActionSchema = z.object({
  action: z.enum(APP_LIFECYCLE_ACTIONS),
});

export type AppCreateInput = z.infer<typeof appCreateSchema>;
export type AppUpdateInput = z.infer<typeof appUpdateSchema>;
export type AppReorderInput = z.infer<typeof appReorderSchema>;
export type AppFavouriteInput = z.infer<typeof appFavouriteSchema>;
export type AppLifecycleActionInput = z.infer<typeof appLifecycleActionSchema>;
