import type { DashboardLayoutDTO, ResolvedWidget } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { getWidgetComponent } from "./widget-registry";

// Responsive column spans per widget width (small/medium/wide/full -> 1/2/3/4).
// Data-driven so a future edit mode (reorder, resize, show/hide, sections) can
// change order/size/grouping without touching the grid itself.
const colSpan: Record<number, string> = {
  1: "lg:col-span-1",
  2: "sm:col-span-2 lg:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
};

function WidgetCard({ widget }: { widget: ResolvedWidget }) {
  const Widget = getWidgetComponent(widget.componentKey);
  const span = colSpan[Math.min(4, Math.max(1, widget.columns))];
  return (
    <Card className={cn("flex flex-col", span)}>
      <CardHeader>
        <CardTitle>{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {Widget ? <Widget /> : <ErrorState message={`Unknown widget: ${widget.componentKey}`} />}
      </CardContent>
    </Card>
  );
}

export function DashboardGrid({ layout }: { layout: DashboardLayoutDTO }) {
  const sections = [...layout.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        // Hidden widgets stay in the document (restorable) but never render here.
        const visible = section.widgets.filter((w) => !w.hidden).sort((a, b) => a.order - b.order);
        if (visible.length === 0) return null;

        return (
          <section key={section.id} className="space-y-4">
            {section.title ? (
              <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
                {section.title}
              </h2>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visible.map((widget) => (
                <WidgetCard key={widget.id} widget={widget} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
