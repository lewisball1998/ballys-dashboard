import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { EventSink } from "./index";

/**
 * Event sink that persists events to the `notifications` table.
 *
 * Persistence + dedupe: if an event carries a `dedupeKey` and a non-dismissed
 * notification with that key already exists, we skip the insert. This keeps a
 * single durable notification per condition (e.g. "X is down") until the user
 * dismisses it — so a persistently-down service does not create a new row every
 * scheduler tick. Once dismissed, a fresh occurrence creates a new notification.
 */
export const dbNotificationSink: EventSink = {
  name: "db",
  handle(event) {
    if (event.dedupeKey) {
      const existing = db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.dedupeKey, event.dedupeKey), eq(notifications.dismissed, false)))
        .limit(1)
        .get();
      if (existing) return;
    }

    db.insert(notifications)
      .values({
        type: event.type,
        severity: event.severity,
        title: event.title,
        message: event.message ?? null,
        source: event.source ?? null,
        dedupeKey: event.dedupeKey ?? null,
      })
      .run();
  },
};
