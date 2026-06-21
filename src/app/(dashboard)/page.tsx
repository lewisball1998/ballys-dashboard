import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { PageHeader } from "@/components/layout/page-header";
import { getResolvedLayout } from "@/server/services/dashboard-layout";

// Reads the persisted layout from SQLite, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const layout = getResolvedLayout();
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="System status and service overview at a glance." />
      <DashboardHome initialLayout={layout} />
    </div>
  );
}
