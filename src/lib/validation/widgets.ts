import { z } from "zod";

/**
 * Dashboard widget schemas. ⭐ ARCHITECT-OWNED.
 *
 * NOTE: v0.1 dashboard layout is a read-only default derived from enabled
 * modules. `dashboardLayoutUpdateSchema` is defined for forward-compatibility
 * with v0.3 layout customisation and is NOT wired to an endpoint in v0.1.
 */
export const widgetSizeSchema = z.object({
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
});

export const dashboardWidgetInputSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  widgetId: z.string().min(1),
  size: widgetSizeSchema,
  order: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const dashboardLayoutUpdateSchema = z.object({
  widgets: z.array(dashboardWidgetInputSchema),
});

export type WidgetSizeInput = z.infer<typeof widgetSizeSchema>;
export type DashboardWidgetInput = z.infer<typeof dashboardWidgetInputSchema>;
export type DashboardLayoutUpdateInput = z.infer<typeof dashboardLayoutUpdateSchema>;
