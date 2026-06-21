import { describe, expect, it } from "vitest";
import { sizeTokenToColumns } from "@/lib/dashboard";
import { dashboardLayoutConfigSchema } from "@/lib/validation";
import type { DashboardLayoutConfig, PlacedWidget, WidgetCatalogEntry } from "@/lib/types";
import { buildWidgetCatalog } from "@/server/dashboard/catalog";
import { buildDefaultLayout } from "@/server/dashboard/default-layout";
import { migrateLayoutConfig } from "@/server/dashboard/migrate-config";
import { reconcileConfig, resolveLayout } from "@/server/dashboard/reconcile";

const catalog: WidgetCatalogEntry[] = [
  { moduleId: "core", widgetKey: "a", componentKey: "a", title: "A", defaultSize: "medium" },
  { moduleId: "core", widgetKey: "b", componentKey: "b", title: "B", defaultSize: "small" },
];

function widget(
  over: Partial<PlacedWidget> & Pick<PlacedWidget, "id" | "widgetKey">,
): PlacedWidget {
  return { hidden: false, size: "medium", order: 0, config: {}, ...over };
}

function config(widgets: PlacedWidget[]): DashboardLayoutConfig {
  return { version: 1, sections: [{ id: "main", title: "", order: 0, widgets }] };
}

/** First section widgets (tests build single-section configs). */
function firstWidgets(layout: DashboardLayoutConfig): PlacedWidget[] {
  return layout.sections[0]!.widgets;
}

describe("size tokens", () => {
  it("maps tokens to 1..4 columns", () => {
    expect(sizeTokenToColumns("small")).toBe(1);
    expect(sizeTokenToColumns("medium")).toBe(2);
    expect(sizeTokenToColumns("wide")).toBe(3);
    expect(sizeTokenToColumns("full")).toBe(4);
  });
});

describe("widget catalog", () => {
  it("includes the four core widgets", () => {
    const keys = buildWidgetCatalog().map((c) => c.widgetKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        "system-overview",
        "favourite-apps",
        "app-health-summary",
        "notifications",
      ]),
    );
  });
});

describe("default layout", () => {
  it("reproduces the previous homepage: one unnamed section, exact order and sizes", () => {
    const layout = buildDefaultLayout();
    expect(layout.version).toBe(1);
    expect(layout.sections).toHaveLength(1);
    const section = layout.sections[0]!;
    expect(section.title).toBe("");
    expect(section.widgets.map((w) => w.widgetKey)).toEqual([
      "system-overview",
      "favourite-apps",
      "app-health-summary",
      "notifications",
    ]);
    expect(section.widgets.map((w) => w.size)).toEqual(["medium", "medium", "small", "small"]);
    expect(section.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3]);
    expect(section.widgets.every((w) => !w.hidden)).toBe(true);
    expect(section.widgets[0]!.id).toBe("core:system-overview");
  });
});

describe("reconcileConfig", () => {
  it("drops widgets whose widgetKey is not in the catalog", () => {
    const result = reconcileConfig(
      config([
        widget({ id: "x:gone", widgetKey: "gone" }),
        widget({ id: "core:a", widgetKey: "a" }),
      ]),
      catalog,
    );
    const keys = result.sections.flatMap((s) => s.widgets.map((w) => w.widgetKey));
    expect(keys).not.toContain("gone");
    expect(keys).toContain("a");
  });

  it("appends catalog widgets missing everywhere to the first section, visible", () => {
    const result = reconcileConfig(config([widget({ id: "core:a", widgetKey: "a" })]), catalog);
    const b = firstWidgets(result).find((w) => w.widgetKey === "b");
    expect(b).toBeDefined();
    expect(b?.hidden).toBe(false);
    expect(b?.id).toBe("core:b");
  });

  it("drops duplicate instance ids (keeps the first)", () => {
    const result = reconcileConfig(
      config([
        widget({ id: "core:a", widgetKey: "a", size: "small" }),
        widget({ id: "core:a", widgetKey: "a", size: "full" }),
      ]),
      catalog,
    );
    const a = firstWidgets(result).filter((w) => w.id === "core:a");
    expect(a).toHaveLength(1);
    expect(a[0]!.size).toBe("small");
  });

  it("normalises per-section widget order to 0..n-1 by input order", () => {
    const result = reconcileConfig(
      config([
        widget({ id: "core:b", widgetKey: "b", order: 5 }),
        widget({ id: "core:a", widgetKey: "a", order: 2 }),
      ]),
      catalog,
    );
    const w = firstWidgets(result);
    expect(w.map((x) => x.widgetKey)).toEqual(["a", "b"]);
    expect(w.map((x) => x.order)).toEqual([0, 1]);
  });

  it("guarantees at least one section when none are provided", () => {
    const result = reconcileConfig({ version: 1, sections: [] }, catalog);
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
    const keys = firstWidgets(result).map((w) => w.widgetKey);
    expect(keys).toEqual(expect.arrayContaining(["a", "b"]));
  });
});

describe("resolveLayout", () => {
  it("joins catalog metadata, maps columns and preserves hidden widgets", () => {
    const dto = resolveLayout(
      config([
        widget({ id: "core:a", widgetKey: "a", size: "full", hidden: true }),
        widget({ id: "core:b", widgetKey: "b", size: "small", order: 1 }),
      ]),
      catalog,
    );
    const widgets = dto.sections[0]!.widgets;
    const a = widgets[0]!;
    const b = widgets[1]!;
    expect(a.title).toBe("A");
    expect(a.componentKey).toBe("a");
    expect(a.columns).toBe(4);
    expect(a.hidden).toBe(true);
    expect(b.columns).toBe(1);
  });
});

describe("migrateLayoutConfig", () => {
  it("is a no-op for the current version and defensive on junk", () => {
    const doc = { version: 1, sections: [] };
    expect(migrateLayoutConfig(doc)).toEqual(doc);
    expect(migrateLayoutConfig(null)).toBeNull();
    expect(migrateLayoutConfig("nope")).toBe("nope");
  });
});

describe("dashboardLayoutConfigSchema", () => {
  it("accepts a valid document and applies field defaults", () => {
    const parsed = dashboardLayoutConfigSchema.safeParse({
      version: 1,
      sections: [{ id: "main", order: 0, widgets: [{ id: "core:a", widgetKey: "a" }] }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const section = parsed.data.sections[0]!;
      const w = section.widgets[0]!;
      expect(w.hidden).toBe(false);
      expect(w.size).toBe("medium");
      expect(section.title).toBe("");
    }
  });

  it("rejects an empty section list, bad size token and non-slug ids", () => {
    expect(dashboardLayoutConfigSchema.safeParse({ version: 1, sections: [] }).success).toBe(false);
    expect(
      dashboardLayoutConfigSchema.safeParse({
        version: 1,
        sections: [
          { id: "main", order: 0, widgets: [{ id: "core:a", widgetKey: "a", size: "huge" }] },
        ],
      }).success,
    ).toBe(false);
    expect(
      dashboardLayoutConfigSchema.safeParse({
        version: 1,
        sections: [{ id: "bad id!", order: 0, widgets: [] }],
      }).success,
    ).toBe(false);
  });
});
