import { describe, expect, it } from "vitest";
import { getWidgetComponent } from "@/components/dashboard/widget-registry";
import { buildWidgetCatalog } from "@/server/dashboard/catalog";

describe("widget registry", () => {
  it("resolves every known componentKey to a component", () => {
    for (const key of [
      "system-overview",
      "app-health-summary",
      "notifications",
      "favourite-apps",
      "app",
    ]) {
      expect(typeof getWidgetComponent(key)).toBe("function");
    }
  });

  it("returns null for an unknown key", () => {
    expect(getWidgetComponent("does-not-exist")).toBeNull();
  });

  it("every catalogued widget maps to a registered component", () => {
    for (const entry of buildWidgetCatalog()) {
      expect(typeof getWidgetComponent(entry.componentKey)).toBe("function");
    }
  });
});
