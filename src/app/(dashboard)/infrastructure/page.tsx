import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemOverviewWidget } from "@/components/dashboard/widgets/system-overview-widget";

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Infrastructure</h1>
        <p className="text-sm text-foreground/60">Local system metrics (container-visible).</p>
      </header>
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
