import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DEFAULT_WIDGETS } from "@/components/dashboard/default-widgets";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-foreground/60">System status and overview.</p>
      </header>
      <DashboardGrid widgets={DEFAULT_WIDGETS} />
    </div>
  );
}
