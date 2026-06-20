/**
 * Notification DTOs. ⭐ ARCHITECT-OWNED (additive — the API contract deferred
 * these to Phase 3). Mirrors the `notifications` table minus the internal
 * `dedupeKey`. Timestamps are ISO strings. Pending Architect ratification.
 */
import type { Severity } from "./common";

export interface NotificationDTO {
  id: number;
  type: string;
  severity: Severity;
  title: string;
  message: string | null;
  source: string | null;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

export interface NotificationCountsDTO {
  /** Active (not dismissed) notifications. */
  total: number;
  /** Active and unread. */
  unread: number;
}
