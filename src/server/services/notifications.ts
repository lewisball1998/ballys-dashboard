import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { Notification } from "@/db/schema";
import type { NotificationCountsDTO, NotificationDTO } from "@/lib/types";
import type { NotificationQuery } from "@/lib/validation";

function toDTO(row: Notification): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message ?? null,
    source: row.source ?? null,
    read: row.read,
    dismissed: row.dismissed,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildWhere(query: NotificationQuery): SQL | undefined {
  const conds: SQL[] = [];
  // Dismissed are hidden unless explicitly included.
  if (query.includeDismissed !== "true") conds.push(eq(notifications.dismissed, false));
  if (query.unread === "true") conds.push(eq(notifications.read, false));
  if (query.severity) conds.push(eq(notifications.severity, query.severity));
  if (query.source) conds.push(eq(notifications.source, query.source));
  return conds.length > 0 ? and(...conds) : undefined;
}

export interface NotificationListResult {
  items: NotificationDTO[];
  total: number;
}

export function listNotifications(query: NotificationQuery): NotificationListResult {
  const where = buildWhere(query);
  const items = db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(query.limit)
    .offset(query.offset)
    .all()
    .map(toDTO);
  const totalRow = db.select({ c: sql<number>`count(*)` }).from(notifications).where(where).get();
  return { items, total: totalRow?.c ?? 0 };
}

export function getCounts(): NotificationCountsDTO {
  const active = db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.dismissed, false))
    .get();
  const unread = db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.dismissed, false), eq(notifications.read, false)))
    .get();
  return { total: active?.c ?? 0, unread: unread?.c ?? 0 };
}

export function markRead(id: number): NotificationDTO | null {
  const row = db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id))
    .returning()
    .get();
  return row ? toDTO(row) : null;
}

export function markAllRead(): number {
  return db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.read, false), eq(notifications.dismissed, false)))
    .run().changes;
}

export function dismiss(id: number): NotificationDTO | null {
  const row = db
    .update(notifications)
    .set({ dismissed: true })
    .where(eq(notifications.id, id))
    .returning()
    .get();
  return row ? toDTO(row) : null;
}

export function dismissAll(): number {
  return db
    .update(notifications)
    .set({ dismissed: true })
    .where(eq(notifications.dismissed, false))
    .run().changes;
}

export function clearDismissed(): number {
  return db.delete(notifications).where(eq(notifications.dismissed, true)).run().changes;
}
