import { EmptyState } from "@/components/ui/empty-state";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="text-sm text-foreground/60">Alerts and events.</p>
      </header>
      <EmptyState
        title="Notification centre coming in Phase 3"
        description="Threshold and health events are already recorded and will appear here."
      />
    </div>
  );
}
