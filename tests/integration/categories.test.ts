import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, categories } from "@/db/schema";
import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
} from "@/server/services/categories";
import { createApp, getApp } from "@/server/services/apps";

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(categories).run();
});

describe("category service", () => {
  it("assigns incrementing sortOrder and lists in order", () => {
    const a = createCategory({ name: "Media" });
    const b = createCategory({ name: "Infra" });
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    expect(listCategories().map((c) => c.name)).toEqual(["Media", "Infra"]);
  });

  it("updates provided fields and returns null for a missing id", () => {
    const a = createCategory({ name: "X" });
    const updated = updateCategory(a.id, { name: "Y", icon: "icon.png" });
    expect(updated?.name).toBe("Y");
    expect(updated?.icon).toBe("icon.png");
    expect(updateCategory(99_999, { name: "Z" })).toBeNull();
  });

  it("reorders by id list and rewrites sortOrder", () => {
    const a = createCategory({ name: "A" });
    const b = createCategory({ name: "B" });
    const c = createCategory({ name: "C" });
    const res = reorderCategories([c.id, a.id, b.id]);
    expect(res.map((x) => x.name)).toEqual(["C", "A", "B"]);
    expect(res.map((x) => x.sortOrder)).toEqual([0, 1, 2]);
  });

  it("nulls apps' categoryId when the category is deleted (FK set null)", () => {
    const cat = createCategory({ name: "Cat" });
    const app = createApp({ name: "App", url: "https://example.com", categoryId: cat.id });
    expect(getApp(app.id)?.categoryId).toBe(cat.id);
    expect(deleteCategory(cat.id)).toBe(true);
    expect(getApp(app.id)?.categoryId).toBeNull();
    expect(deleteCategory(cat.id)).toBe(false);
  });
});
