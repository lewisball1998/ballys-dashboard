import { EmptyState } from "@/components/ui/empty-state";

/**
 * Placeholder until the app launcher + health engine land in Phase 2. The widget
 * slot and registry mapping exist now so the dashboard layout is complete.
 */
export function AppHealthSummaryWidget() {
  return (
    <EmptyState
      title="No apps yet"
      description="Add apps in the launcher to see health here (arriving in Phase 2)."
    />
  );
}
