import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, categories } from "@/db/schema";
import { appCreateSchema, appReorderSchema } from "@/lib/validation";
import {
  applyLifecycle,
  createApp,
  getApp,
  listApps,
  reorderApps,
  setFavourite,
} from "@/server/services/apps";
import { createCategory } from "@/server/services/categories";

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(categories).run();
});

describe("app service", () => {
  it("assigns per-category sortOrder on create", () => {
    const cat = createCategory({ name: "C" });
    const a = createApp({ name: "a", url: "https://a.test", categoryId: cat.id });
    const b = createApp({ name: "b", url: "https://b.test", categoryId: cat.id });
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    // uncategorized has its own sequence
    expect(createApp({ name: "u", url: "https://u.test" }).sortOrder).toBe(0);
  });

  it("applies the three orthogonal lifecycle axes independently", () => {
    const app = createApp({ name: "A", url: "https://a.test", healthEnabled: true });

    expect(applyLifecycle(app.id, "hide")?.isHidden).toBe(true);
    expect(applyLifecycle(app.id, "disable-health")?.healthEnabled).toBe(false);
    expect(applyLifecycle(app.id, "retire")?.lifecycle).toBe("retired");

    // active list excludes retired; "all" includes it
    expect(listApps({ lifecycle: "active", includeHidden: true }).some((a) => a.id === app.id)).toBe(false);
    expect(listApps({ lifecycle: "all", includeHidden: true }).some((a) => a.id === app.id)).toBe(true);

    expect(applyLifecycle(app.id, "restore")?.lifecycle).toBe("active");
    expect(applyLifecycle(app.id, "enable-health")?.healthEnabled).toBe(true);
    expect(applyLifecycle(app.id, "unhide")?.isHidden).toBe(false);

    // includeHidden filter
    applyLifecycle(app.id, "hide");
    expect(listApps({ lifecycle: "active", includeHidden: false }).some((a) => a.id === app.id)).toBe(false);
    expect(applyLifecycle(99_999, "hide")).toBeNull();
  });

  it("toggles favourite", () => {
    const a = createApp({ name: "a", url: "https://a.test" });
    expect(setFavourite(a.id, true)?.isFavourite).toBe(true);
    expect(setFavourite(a.id, false)?.isFavourite).toBe(false);
    expect(setFavourite(99_999, true)).toBeNull();
  });

  it("reorders apps and rewrites sortOrder", () => {
    const a = createApp({ name: "a", url: "https://a.test" });
    const b = createApp({ name: "b", url: "https://b.test" });
    const c = createApp({ name: "c", url: "https://c.test" });
    reorderApps({ ids: [c.id, a.id, b.id] });
    const byId = new Map(listApps({ lifecycle: "all", includeHidden: true }).map((x) => [x.id, x.sortOrder]));
    expect(byId.get(c.id)).toBe(0);
    expect(byId.get(a.id)).toBe(1);
    expect(byId.get(b.id)).toBe(2);
  });

  it("moves apps between categories on reorder", () => {
    const cat = createCategory({ name: "C" });
    const a = createApp({ name: "a", url: "https://a.test" });
    expect(getApp(a.id)?.categoryId).toBeNull();
    reorderApps({ categoryId: cat.id, ids: [a.id] });
    expect(getApp(a.id)?.categoryId).toBe(cat.id);
  });
});

describe("published app schemas (validation)", () => {
  it("rejects a non-http url", () => {
    expect(appCreateSchema.safeParse({ name: "a", url: "ftp://x" }).success).toBe(false);
  });
  it("rejects an empty name", () => {
    expect(appCreateSchema.safeParse({ name: "", url: "https://a.test" }).success).toBe(false);
  });
  it("accepts a valid create", () => {
    expect(appCreateSchema.safeParse({ name: "a", url: "https://a.test" }).success).toBe(true);
  });
  it("requires at least one id to reorder", () => {
    expect(appReorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
