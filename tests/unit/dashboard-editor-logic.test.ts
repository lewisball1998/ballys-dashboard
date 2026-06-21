import { describe, expect, it } from "vitest";
import type { AppDTO, DashboardLayoutDTO, ResolvedWidget } from "@/lib/types";
import {
  addAppWidget,
  addSection,
  canDeleteSection,
  deleteSection,
  dtoToConfig,
  isDirty,
  moveSection,
  moveWidget,
  moveWidgetToSection,
  placedAppIds,
  removeWidget,
  renameSection,
  setWidgetSize,
  slugifySectionId,
  toggleWidgetHidden,
} from "@/components/dashboard/dashboard-editor-logic";

function widget(id: string, over: Partial<ResolvedWidget> = {}): ResolvedWidget {
  return {
    id,
    widgetKey: id,
    componentKey: id,
    title: id,
    size: "medium",
    columns: 2,
    hidden: false,
    order: 0,
    config: {},
    instanceable: false,
    ...over,
  };
}

function app(id: number, name = `App ${id}`): AppDTO {
  return {
    id,
    categoryId: null,
    name,
    url: `https://example.test/${id}`,
    icon: null,
    description: null,
    openNewTab: true,
    isFavourite: false,
    authRequired: false,
    healthUrl: null,
    healthEnabled: false,
    healthInsecureTls: false,
    isHidden: false,
    lifecycle: "active",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    latestHealth: null,
  };
}

function draft(): DashboardLayoutDTO {
  return {
    version: 1,
    sections: [
      { id: "main", title: "", order: 0, widgets: [widget("a"), widget("b")] },
      { id: "ops", title: "Ops", order: 1, widgets: [widget("c")] },
    ],
  };
}

const sectionIds = (d: DashboardLayoutDTO) => d.sections.map((s) => s.id);
const widgetIds = (d: DashboardLayoutDTO, sid: string) =>
  d.sections.find((s) => s.id === sid)!.widgets.map((w) => w.id);

describe("dtoToConfig", () => {
  it("strips render-only fields and renumbers orders by position", () => {
    const cfg = dtoToConfig(draft());
    expect(cfg.version).toBe(1);
    expect(cfg.sections.map((s) => s.order)).toEqual([0, 1]);
    const w0 = cfg.sections[0]!.widgets[0]!;
    expect(Object.keys(w0).sort()).toEqual([
      "config",
      "hidden",
      "id",
      "order",
      "size",
      "widgetKey",
    ]);
    expect(cfg.sections[0]!.widgets.map((w) => w.order)).toEqual([0, 1]);
  });
});

describe("isDirty", () => {
  it("is false for an identical draft and true after a change", () => {
    const d = draft();
    expect(isDirty(d, draft())).toBe(false);
    expect(isDirty(toggleWidgetHidden(d, "a"), d)).toBe(true);
  });
});

describe("slugifySectionId", () => {
  it("slugifies, sanitises and de-duplicates", () => {
    expect(slugifySectionId("My New Section", [])).toBe("my-new-section");
    expect(slugifySectionId("  weird @@ name!! ", [])).toBe("weird-name");
    expect(slugifySectionId("Ops", ["ops"])).toBe("ops-2");
    expect(slugifySectionId("###", [])).toBe("section");
    expect(slugifySectionId("My New Section", [])).toMatch(/^[A-Za-z0-9:_-]+$/);
  });
});

describe("section operations", () => {
  it("adds a section with a unique slug id and trimmed title", () => {
    const d = addSection(draft(), "  Monitoring  ");
    expect(sectionIds(d)).toEqual(["main", "ops", "monitoring"]);
    expect(d.sections[2]!.title).toBe("Monitoring");
    expect(d.sections[2]!.widgets).toEqual([]);
  });

  it("renames a section", () => {
    const d = renameSection(draft(), "ops", "Operations");
    expect(d.sections.find((s) => s.id === "ops")!.title).toBe("Operations");
  });

  it("moves a section up/down and is a no-op at the ends", () => {
    expect(sectionIds(moveSection(draft(), "ops", "up"))).toEqual(["ops", "main"]);
    expect(sectionIds(moveSection(draft(), "main", "up"))).toEqual(["main", "ops"]);
    expect(sectionIds(moveSection(draft(), "ops", "down"))).toEqual(["main", "ops"]);
  });

  it("only allows deleting an empty, non-last section", () => {
    const d = draft();
    expect(canDeleteSection(d, "ops")).toBe(false); // has a widget
    const emptied = moveWidgetToSection(d, "c", "main");
    expect(canDeleteSection(emptied, "ops")).toBe(true);
    expect(sectionIds(deleteSection(emptied, "ops"))).toEqual(["main"]);
    // cannot delete the last remaining section even if empty
    const single: DashboardLayoutDTO = {
      version: 1,
      sections: [{ id: "main", title: "", order: 0, widgets: [] }],
    };
    expect(canDeleteSection(single, "main")).toBe(false);
    expect(deleteSection(single, "main")).toBe(single);
  });
});

describe("widget operations", () => {
  it("moves a widget within its section and is a no-op at the ends", () => {
    expect(widgetIds(moveWidget(draft(), "main", "b", "up"), "main")).toEqual(["b", "a"]);
    expect(widgetIds(moveWidget(draft(), "main", "a", "up"), "main")).toEqual(["a", "b"]);
    expect(widgetIds(moveWidget(draft(), "main", "b", "down"), "main")).toEqual(["a", "b"]);
  });

  it("moves a widget to another section (appended at the end)", () => {
    const d = moveWidgetToSection(draft(), "a", "ops");
    expect(widgetIds(d, "main")).toEqual(["b"]);
    expect(widgetIds(d, "ops")).toEqual(["c", "a"]);
  });

  it("toggles hidden", () => {
    const d = toggleWidgetHidden(draft(), "a");
    expect(d.sections[0]!.widgets[0]!.hidden).toBe(true);
    expect(toggleWidgetHidden(d, "a").sections[0]!.widgets[0]!.hidden).toBe(false);
  });

  it("sets size and recomputes columns", () => {
    const d = setWidgetSize(draft(), "a", "full");
    const a = d.sections[0]!.widgets[0]!;
    expect(a.size).toBe("full");
    expect(a.columns).toBe(4);
    expect(setWidgetSize(draft(), "a", "small").sections[0]!.widgets[0]!.columns).toBe(1);
  });

  it("does not mutate the input draft", () => {
    const d = draft();
    const snapshot = JSON.stringify(d);
    toggleWidgetHidden(d, "a");
    moveWidget(d, "main", "a", "down");
    addSection(d, "X");
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});

describe("app widget operations", () => {
  it("adds an app widget in resolved shape with appId in config", () => {
    const d = addAppWidget(draft(), app(42, "Grafana"), "ops");
    const added = d.sections.find((s) => s.id === "ops")!.widgets.at(-1)!;
    expect(added.id).toBe("app:42");
    expect(added.widgetKey).toBe("app");
    expect(added.componentKey).toBe("app");
    expect(added.title).toBe("Grafana");
    expect(added.instanceable).toBe(true);
    expect(added.config).toEqual({ appId: 42 });
    expect(added.size).toBe("small");
    expect(added.columns).toBe(1);
    // round-trips through dtoToConfig, keeping appId in config
    const cfg = dtoToConfig(d);
    const placed = cfg.sections.find((s) => s.id === "ops")!.widgets.at(-1)!;
    expect(placed.config).toEqual({ appId: 42 });
  });

  it("prevents duplicate app widgets (one per app, no-op)", () => {
    const once = addAppWidget(draft(), app(42), "main");
    const twice = addAppWidget(once, app(42), "ops");
    expect(placedAppIds(twice)).toEqual([42]);
    expect(twice).toBe(once); // unchanged reference on no-op
  });

  it("no-ops when the target section does not exist", () => {
    const d = draft();
    expect(addAppWidget(d, app(7), "nope")).toBe(d);
  });

  it("placedAppIds collects app ids across sections", () => {
    let d = addAppWidget(draft(), app(1), "main");
    d = addAppWidget(d, app(2), "ops");
    expect(placedAppIds(d).sort()).toEqual([1, 2]);
  });

  it("removes an instanceable widget but never a built-in", () => {
    const d = addAppWidget(draft(), app(42), "main");
    const removed = removeWidget(d, "app:42");
    expect(placedAppIds(removed)).toEqual([]);
    // built-in widgets are not removable (no-op, same reference)
    expect(removeWidget(d, "a")).toBe(d);
  });

  it("does not mutate the input draft when adding/removing", () => {
    const d = draft();
    const snapshot = JSON.stringify(d);
    addAppWidget(d, app(99), "main");
    const withApp = addAppWidget(d, app(99), "main");
    const withAppSnapshot = JSON.stringify(withApp);
    removeWidget(withApp, "app:99");
    expect(JSON.stringify(d)).toBe(snapshot);
    expect(JSON.stringify(withApp)).toBe(withAppSnapshot);
  });
});
