import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemOverviewWidget } from "@/components/dashboard/widgets/system-overview-widget";
import { PageHeader } from "@/components/layout/page-header";

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Infrastructure" description="Local system metrics (container-visible)." />
      <Card>
        <CardHeader>
          <CardTitle>System metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <SystemOverviewWidget />
        </CardContent>
      </Card>
    </div>
  );
}
