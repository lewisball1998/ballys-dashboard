import type { DashboardWidgetDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { getWidgetComponent } from "./widget-registry";

// Responsive column spans per widget width. Data-driven so a future layout/edit
// mode (reorder, resize, show/hide) can change order/size without grid changes.
const colSpan: Record<number, string> = {
  1: "lg:col-span-1",
  2: "sm:col-span-2 lg:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
};

export function DashboardGrid({ widgets }: { widgets: DashboardWidgetDTO[] }) {
  const ordered = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ordered.map((widget) => {
        const Widget = getWidgetComponent(widget.componentKey);
        const span = colSpan[Math.min(4, Math.max(1, widget.size.w))];
        return (
          <Card key={widget.id} className={cn("flex flex-col", span)}>
            <CardHeader>
              <CardTitle>{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {Widget ? (
                <Widget />
              ) : (
                <ErrorState message={`Unknown widget: ${widget.componentKey}`} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
