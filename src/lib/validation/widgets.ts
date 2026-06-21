import { z } from "zod";
import { APP_WIDGET_KEY, WIDGET_SIZE_TOKENS } from "@/lib/dashboard";

/**
 * Dashboard layout schemas. ⭐ ARCHITECT-OWNED.
 *
 * `dashboardLayoutConfigSchema` validates the persisted layout document and the
 * `PUT /api/dashboard/layout` body. It is intentionally permissive on `version`
 * (older documents are upgraded by migrateLayoutConfig before validation) and on
 * content (the server reconciles the result against the widget catalog: unknown
 * widgetKeys are dropped, missing ones appended). Bounds exist purely to reject
 * abusive payloads, not to encode product rules.
 */

/** ids are stable slugs like "core:system-overview" or "main". */
const idSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9:_-]+$/, "must be a slug ([A-Za-z0-9:_-])");

export const widgetSizeTokenSchema = z.enum(WIDGET_SIZE_TOKENS);

export const placedWidgetSchema = z
  .object({
    id: idSchema,
    widgetKey: idSchema,
    hidden: z.boolean().default(false),
    size: widgetSizeTokenSchema.default("medium"),
    order: z.number().int().min(0).default(0),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  // App widgets (widgetKey "app") must carry a positive-integer `config.appId`.
  // Other widgets keep an unconstrained config bag. Reconcile defensively drops
  // any app instance that still slips through with a malformed appId.
  .refine(
    (w) =>
      w.widgetKey !== APP_WIDGET_KEY ||
      (typeof w.config.appId === "number" &&
        Number.isInteger(w.config.appId) &&
        w.config.appId > 0),
    { message: "app widget requires config.appId (positive integer)", path: ["config", "appId"] },
  );

export const layoutSectionSchema = z.object({
  id: idSchema,
  title: z.string().max(120).default(""),
  order: z.number().int().min(0).default(0),
  widgets: z.array(placedWidgetSchema).max(200),
});

export const dashboardLayoutConfigSchema = z.object({
  version: z.number().int().min(1).max(1_000_000),
  sections: z.array(layoutSectionSchema).min(1).max(50),
});

export type WidgetSizeTokenInput = z.infer<typeof widgetSizeTokenSchema>;
export type PlacedWidgetInput = z.infer<typeof placedWidgetSchema>;
export type LayoutSectionInput = z.infer<typeof layoutSectionSchema>;
export type DashboardLayoutConfigInput = z.infer<typeof dashboardLayoutConfigSchema>;
