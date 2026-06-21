import { describe, expect, it } from "vitest";
import { APP_WIDGET_KEY, appWidgetId, sizeTokenToColumns } from "@/lib/dashboard";
import { dashboardLayoutConfigSchema } from "@/lib/validation";
import type { DashboardLayoutConfig, PlacedWidget, WidgetCatalogEntry } from "@/lib/types";
import { buildWidgetCatalog } from "@/server/dashboard/catalog";
import { buildDefaultLayout } from "@/server/dashboard/default-layout";
import { migrateLayoutConfig } from "@/server/dashboard/migrate-config";
import { reconcileConfig, resolveLayout } from "@/server/dashboard/reconcile";

const catalog: WidgetCatalogEntry[] = [
  {
    moduleId: "core",
    widgetKey: "a",
    componentKey: "a",
    title: "A",
    defaultSize: "medium",
    instanceable: false,
  },
  {
    moduleId: "core",
    widgetKey: "b",
    componentKey: "b",
    title: "B",
    defaultSize: "small",
    instanceable: false,
  },
];

/** Catalog including the generic, instanceable app widget. */
const appCatalog: WidgetCatalogEntry[] = [
  ...catalog,
  {
    moduleId: "core",
    widgetKey: APP_WIDGET_KEY,
    componentKey: APP_WIDGET_KEY,
    title: "App",
    defaultSize: "small",
    instanceable: true,
  },
];

/** Build an app-widget PlacedWidget bound to `appId`. */
function appWidget(appId: number, over: Partial<PlacedWidget> = {}): PlacedWidget {
  return {
    id: appWidgetId(appId),
    widgetKey: APP_WIDGET_KEY,
    hidden: false,
    size: "small",
    order: 0,
    config: { appId },
    ...over,
  };
}

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

  it("includes the generic app widget marked instanceable", () => {
    const app = buildWidgetCatalog().find((c) => c.widgetKey === APP_WIDGET_KEY);
    expect(app).toBeDefined();
    expect(app?.instanceable).toBe(true);
    expect(app?.componentKey).toBe(APP_WIDGET_KEY);
  });

  it("marks the built-in widgets non-instanceable", () => {
    const builtins = buildWidgetCatalog().filter((c) => c.widgetKey !== APP_WIDGET_KEY);
    expect(builtins.every((c) => c.instanceable === false)).toBe(true);
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

  it("keeps valid app widget instances", () => {
    const result = reconcileConfig(
      config([appWidget(42), widget({ id: "core:a", widgetKey: "a" })]),
      appCatalog,
    );
    const app = firstWidgets(result).find((w) => w.id === appWidgetId(42));
    expect(app).toBeDefined();
    expect(app?.widgetKey).toBe(APP_WIDGET_KEY);
    expect(app?.config).toEqual({ appId: 42 });
  });

  it("does NOT auto-append the instanceable app template", () => {
    const result = reconcileConfig(config([widget({ id: "core:a", widgetKey: "a" })]), appCatalog);
    const keys = result.sections.flatMap((s) => s.widgets.map((w) => w.widgetKey));
    expect(keys).toContain("b"); // singleton still auto-appended
    expect(keys).not.toContain(APP_WIDGET_KEY); // template never seeded
  });

  it("drops malformed app widgets (missing / invalid appId)", () => {
    const result = reconcileConfig(
      config([
        appWidget(1, { id: "app:1", config: {} }), // no appId
        appWidget(2, { id: "app:2", config: { appId: 0 } }), // not positive
        appWidget(3, { id: "app:3", config: { appId: "x" } }), // not a number
        appWidget(4), // valid
      ]),
      appCatalog,
    );
    const appIds = firstWidgets(result)
      .filter((w) => w.widgetKey === APP_WIDGET_KEY)
      .map((w) => w.id);
    expect(appIds).toEqual([appWidgetId(4)]); // only the valid app instance survives
  });

  it("dedupes app widgets by instance id (keeps the first)", () => {
    const result = reconcileConfig(
      config([appWidget(42, { size: "small" }), appWidget(42, { size: "full" })]),
      appCatalog,
    );
    const apps = firstWidgets(result).filter((w) => w.id === appWidgetId(42));
    expect(apps).toHaveLength(1);
    expect(apps[0]!.size).toBe("small");
  });
});

describe("instanceable in default layout", () => {
  it("never seeds instanceable widgets into the default layout", () => {
    const layout = buildDefaultLayout(appCatalog);
    const keys = layout.sections.flatMap((s) => s.widgets.map((w) => w.widgetKey));
    expect(keys).toContain("a");
    expect(keys).toContain("b");
    expect(keys).not.toContain(APP_WIDGET_KEY);
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
    expect(a.instanceable).toBe(false);
    expect(b.columns).toBe(1);
  });

  it("marks app widgets instanceable and carries their config", () => {
    const dto = resolveLayout(config([appWidget(42)]), appCatalog);
    const app = dto.sections[0]!.widgets[0]!;
    expect(app.instanceable).toBe(true);
    expect(app.componentKey).toBe(APP_WIDGET_KEY);
    expect(app.config).toEqual({ appId: 42 });
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

  it("accepts an app widget with a positive-integer config.appId", () => {
    const parsed = dashboardLayoutConfigSchema.safeParse({
      version: 1,
      sections: [
        {
          id: "main",
          order: 0,
          widgets: [{ id: "app:42", widgetKey: APP_WIDGET_KEY, config: { appId: 42 } }],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an app widget without a valid config.appId", () => {
    const bad = (config: unknown) =>
      dashboardLayoutConfigSchema.safeParse({
        version: 1,
        sections: [
          { id: "main", order: 0, widgets: [{ id: "app:1", widgetKey: APP_WIDGET_KEY, config }] },
        ],
      }).success;
    expect(bad({})).toBe(false); // missing
    expect(bad({ appId: 0 })).toBe(false); // not positive
    expect(bad({ appId: 1.5 })).toBe(false); // not integer
    expect(bad({ appId: "1" })).toBe(false); // not a number
  });
});
