import { z } from "zod";
import { THEME_MODES, ACCENT_COLORS } from "@/lib/types/settings";

/** Settings request schemas. ⭐ ARCHITECT-OWNED. */

export const thresholdSchema = z.object({
  cpuPercent: z.number().int().min(1).max(100),
  memoryPercent: z.number().int().min(1).max(100),
  storagePercent: z.number().int().min(1).max(100),
});

/**
 * PATCH /api/settings body. All fields optional (partial update). `setupCompleted`
 * is intentionally excluded — it is owned by the setup flow, not general settings.
 * Interval bounds: 5s..1h. Retention: 1..365 days.
 */
export const settingsUpdateSchema = z
  .object({
    dashboardName: z.string().trim().min(1).max(80),
    theme: z.enum(THEME_MODES),
    accent: z.enum(ACCENT_COLORS),
    timezone: z.string().trim().min(1).max(64),
    logoPath: z.string().trim().max(512).nullable(),
    authEnabled: z.boolean(),
    appHealthIntervalMs: z.number().int().min(5_000).max(3_600_000),
    systemMetricIntervalMs: z.number().int().min(5_000).max(3_600_000),
    metricRetentionDays: z.number().int().min(1).max(365),
    thresholds: thresholdSchema,
  })
  .partial();

export type ThresholdInput = z.infer<typeof thresholdSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
