import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DEFAULT_WIDGETS } from "@/components/dashboard/default-widgets";
import { PageHeader } from "@/components/layout/page-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="System status and service overview at a glance." />
      <DashboardGrid widgets={DEFAULT_WIDGETS} />
    </div>
  );
}
