import { PageHeader } from "@/components/layout/page-header";
import { InfrastructureDashboard } from "@/components/infrastructure/infrastructure-dashboard";

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure"
        description="System, storage and hardware health (container-visible · where available)."
      />
      <InfrastructureDashboard />
    </div>
  );
}
