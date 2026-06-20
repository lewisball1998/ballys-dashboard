import { describe, expect, it } from "vitest";
import { getWidgetComponent } from "@/components/dashboard/widget-registry";
import { DEFAULT_WIDGETS } from "@/components/dashboard/default-widgets";

describe("widget registry", () => {
  it("resolves every known componentKey to a component", () => {
    for (const key of ["system-overview", "app-health-summary", "notifications"]) {
      expect(typeof getWidgetComponent(key)).toBe("function");
    }
  });

  it("returns null for an unknown key", () => {
    expect(getWidgetComponent("does-not-exist")).toBeNull();
  });

  it("every default widget maps to a registered component", () => {
    for (const widget of DEFAULT_WIDGETS) {
      expect(typeof getWidgetComponent(widget.componentKey)).toBe("function");
    }
  });
});
