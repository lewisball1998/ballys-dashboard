import { EmptyState } from "@/components/ui/empty-state";

/**
 * Placeholder until the notification centre UI lands in Phase 3. Threshold
 * notifications are already persisted server-side; this slot will render them.
 */
export function NotificationsWidget() {
  return <EmptyState title="No notifications" description="You are all caught up." />;
}
