import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { EventSink } from "./index";

/**
 * Event sink that persists events to the `notifications` table, completing the
 * skeleton so threshold/health events become durable notifications. The pipeline
 * already deduplicates within a TTL window before this runs (see events/index).
 * Full notification rules (read/recovered flows, richer formatting) come later.
 */
export const dbNotificationSink: EventSink = {
  name: "db",
  handle(event) {
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
