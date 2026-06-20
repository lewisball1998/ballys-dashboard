import { z } from "zod";
import { severitySchema } from "./common";

/**
 * Notification query schema. ⭐ ARCHITECT-OWNED (additive, see types/notifications).
 * Boolean filters use "true"/"false" strings (query params), interpreted by the
 * route. Notifications are server-generated, so there are no create/update bodies.
 */
export const notificationQuerySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  includeDismissed: z.enum(["true", "false"]).optional(),
  severity: severitySchema.optional(),
  source: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
