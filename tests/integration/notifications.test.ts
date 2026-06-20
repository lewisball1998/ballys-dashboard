import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { notifications } from "@/db/schema";
import type { DashboardEvent } from "@/server/events";
import { dbNotificationSink } from "@/server/events/db-sink";
import type { NotificationQuery } from "@/lib/validation";
import {
  clearDismissed,
  dismiss,
  dismissAll,
  getCounts,
  listNotifications,
  markAllRead,
  markRead,
} from "@/server/services/notifications";

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(notifications).run();
});

/** Persist via the real DB sink (exercises insert + dedupe). */
function emit(partial: Partial<DashboardEvent>): void {
  dbNotificationSink.handle({ type: "t", severity: "info", title: "T", ...partial });
}

function q(over: Partial<NotificationQuery> = {}): NotificationQuery {
  return { limit: 50, offset: 0, ...over };
}

describe("notification service", () => {
  it("lists newest first with a correct total", () => {
    emit({ title: "A" });
    emit({ title: "B" });
    const res = listNotifications(q());
    expect(res.total).toBe(2);
    expect(res.items[0]?.title).toBe("B");
  });

  it("dedupes active notifications by dedupeKey until dismissed", () => {
    emit({ dedupeKey: "k", title: "down" });
    emit({ dedupeKey: "k", title: "down again" });
    expect(listNotifications(q()).total).toBe(1); // deduped

    const active = listNotifications(q());
    dismiss(active.items[0]!.id);
    emit({ dedupeKey: "k", title: "down 3" }); // dismissed → new one allowed

    expect(listNotifications(q()).total).toBe(1); // one active again
    expect(listNotifications(q({ includeDismissed: "true" })).total).toBe(2);
  });

  it("computes counts (active total + unread)", () => {
    emit({ title: "A" });
    emit({ title: "B" });
    expect(getCounts()).toEqual({ total: 2, unread: 2 });

    markRead(listNotifications(q()).items[0]!.id);
    expect(getCounts()).toEqual({ total: 2, unread: 1 });
  });

  it("marks one and all as read", () => {
    emit({});
    emit({});
    expect(markAllRead()).toBe(2);
    expect(getCounts().unread).toBe(0);
    expect(markRead(99_999)).toBeNull();
  });

  it("dismisses one, all, and clears dismissed", () => {
    emit({});
    emit({});
    expect(dismissAll()).toBe(2);
    expect(getCounts().total).toBe(0);
    expect(listNotifications(q()).total).toBe(0); // hidden by default
    expect(listNotifications(q({ includeDismissed: "true" })).total).toBe(2);
    expect(clearDismissed()).toBe(2);
    expect(listNotifications(q({ includeDismissed: "true" })).total).toBe(0);
    expect(dismiss(99_999)).toBeNull();
  });

  it("filters by severity, source, and unread", () => {
    emit({ severity: "error", source: "app-health", title: "e" });
    emit({ severity: "info", source: "system", title: "i" });

    expect(listNotifications(q({ severity: "error" })).total).toBe(1);
    expect(listNotifications(q({ source: "system" })).total).toBe(1);

    markRead(listNotifications(q({ severity: "error" })).items[0]!.id);
    const unread = listNotifications(q({ unread: "true" }));
    expect(unread.total).toBe(1);
    expect(unread.items[0]?.source).toBe("system");
  });

  it("applies limit and offset", () => {
    for (let i = 0; i < 5; i++) emit({ title: `n${i}` });
    expect(listNotifications(q({ limit: 2 })).items).toHaveLength(2);
    expect(listNotifications(q({ limit: 2, offset: 4 })).items).toHaveLength(1);
    expect(listNotifications(q()).total).toBe(5);
  });
});
