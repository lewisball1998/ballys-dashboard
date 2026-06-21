import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { dashboardLayouts } from "@/db/schema";
import { getResolvedLayout, resetLayout, saveLayout } from "@/server/services/dashboard-layout";
import { buildDefaultLayout } from "@/server/dashboard/default-layout";
import type { DashboardLayoutConfig } from "@/lib/types";

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(dashboardLayouts).run();
});

function visibleKeys(layout: {
  sections: { widgets: { widgetKey: string; hidden: boolean }[] }[];
}): string[] {
  return layout.sections.flatMap((s) => s.widgets.filter((w) => !w.hidden).map((w) => w.widgetKey));
}

describe("dashboard layout service", () => {
  it("returns the computed default when nothing is stored", () => {
    const layout = getResolvedLayout();
    expect(layout.sections).toHaveLength(1);
    expect(visibleKeys(layout)).toEqual([
      "system-overview",
      "favourite-apps",
      "app-health-summary",
      "notifications",
    ]);
  });

  it("persists hide + reorder + resize and reflects them on read", () => {
    const base = buildDefaultLayout();
    const widgets = base.sections[0]!.widgets;
    // hide notifications, make system-overview full width, and move favourite-apps first.
    widgets.find((w) => w.widgetKey === "notifications")!.hidden = true;
    widgets.find((w) => w.widgetKey === "system-overview")!.size = "full";
    widgets.find((w) => w.widgetKey === "system-overview")!.order = 1;
    widgets.find((w) => w.widgetKey === "favourite-apps")!.order = 0;

    saveLayout(base);

    expect(db.select().from(dashboardLayouts).all()).toHaveLength(1);

    const layout = getResolvedLayout();
    const section = layout.sections[0]!;
    // notifications hidden -> not in the visible set, but still present in the document.
    expect(visibleKeys(layout)).not.toContain("notifications");
    expect(section.widgets.some((w) => w.widgetKey === "notifications" && w.hidden)).toBe(true);
    // favourite-apps now before system-overview.
    expect(section.widgets.map((w) => w.widgetKey).slice(0, 2)).toEqual([
      "favourite-apps",
      "system-overview",
    ]);
    // size token resolved to columns.
    const sys = section.widgets.find((w) => w.widgetKey === "system-overview")!;
    expect(sys.size).toBe("full");
    expect(sys.columns).toBe(4);
  });

  it("restores a hidden widget when un-hidden and saved", () => {
    const base = buildDefaultLayout();
    base.sections[0]!.widgets.find((w) => w.widgetKey === "notifications")!.hidden = true;
    saveLayout(base);
    expect(visibleKeys(getResolvedLayout())).not.toContain("notifications");

    const stored = buildDefaultLayout();
    stored.sections[0]!.widgets.find((w) => w.widgetKey === "notifications")!.hidden = false;
    saveLayout(stored);
    expect(visibleKeys(getResolvedLayout())).toContain("notifications");
  });

  it("reset clears the stored row and returns the default", () => {
    saveLayout(buildDefaultLayout());
    expect(db.select().from(dashboardLayouts).all()).toHaveLength(1);

    const layout = resetLayout();
    expect(db.select().from(dashboardLayouts).all()).toHaveLength(0);
    expect(visibleKeys(layout)).toContain("system-overview");
  });

  it("falls back to the default when the stored config is corrupt JSON", () => {
    db.insert(dashboardLayouts)
      .values({ kind: "user-default", ownerKey: null, schemaVersion: 1, config: "not json {" })
      .run();
    expect(() => getResolvedLayout()).not.toThrow();
    expect(visibleKeys(getResolvedLayout())).toContain("system-overview");
  });

  it("falls back to the default when the stored config is structurally invalid", () => {
    const invalid: unknown = { version: 1, sections: [] };
    db.insert(dashboardLayouts)
      .values({
        kind: "user-default",
        ownerKey: null,
        schemaVersion: 1,
        config: JSON.stringify(invalid as DashboardLayoutConfig),
      })
      .run();
    expect(visibleKeys(getResolvedLayout())).toEqual([
      "system-overview",
      "favourite-apps",
      "app-health-summary",
      "notifications",
    ]);
  });

  it("drops a stored widget whose key is no longer in the catalog", () => {
    const base = buildDefaultLayout();
    base.sections[0]!.widgets.push({
      id: "legacy:ghost",
      widgetKey: "ghost",
      hidden: false,
      size: "medium",
      order: 99,
      config: {},
    });
    saveLayout(base);
    const keys = getResolvedLayout().sections.flatMap((s) => s.widgets.map((w) => w.widgetKey));
    expect(keys).not.toContain("ghost");
  });
});
