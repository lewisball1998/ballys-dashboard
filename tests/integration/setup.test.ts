import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, categories, notifications, settings } from "@/db/schema";
import { completeSetup, getSetupStatus, seedFromTemplate } from "@/server/services/setup";
import { createApp } from "@/server/services/apps";
import { createCategory, listCategories } from "@/server/services/categories";
import { getSettings } from "@/server/services/settings";

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(categories).run();
  db.delete(notifications).run();
  db.delete(settings).run();
});

describe("setup status", () => {
  it("reports incomplete with defaults and templates before completion", () => {
    const status = getSetupStatus();
    expect(status.setupCompleted).toBe(false);
    expect(status.appCount).toBe(0);
    expect(status.categoryCount).toBe(0);
    const homelab = status.templates.find((t) => t.id === "homelab");
    expect(homelab?.categories).toEqual(["Media", "Infrastructure", "Automation", "AI", "Utilities"]);
  });

  it("reflects current app/category counts", () => {
    createCategory({ name: "X" });
    createApp({ name: "a", url: "https://a.test" });
    const status = getSetupStatus();
    expect(status.categoryCount).toBe(1);
    expect(status.appCount).toBe(1);
  });
});

describe("setup completion", () => {
  it("marks complete and persists; is idempotent", () => {
    expect(getSetupStatus().setupCompleted).toBe(false);
    expect(completeSetup().setupCompleted).toBe(true);
    expect(getSetupStatus().setupCompleted).toBe(true);
    // running again does not error and stays complete
    expect(completeSetup().setupCompleted).toBe(true);
    expect(getSetupStatus().setupCompleted).toBe(true);
  });

  it("applies optional final settings on completion", () => {
    completeSetup({ dashboardName: "Home Lab", theme: "dark", accent: "emerald" });
    const s = getSettings();
    expect(s.dashboardName).toBe("Home Lab");
    expect(s.theme).toBe("dark");
    expect(s.accent).toBe("emerald");
    expect(s.setupCompleted).toBe(true);
  });

  it("does not destroy existing apps/categories", () => {
    const cat = createCategory({ name: "Keep" });
    const app = createApp({ name: "Keep App", url: "https://keep.test", categoryId: cat.id });
    completeSetup();
    const status = getSetupStatus();
    expect(status.categoryCount).toBe(1);
    expect(status.appCount).toBe(1);
    expect(listCategories().find((c) => c.id === cat.id)?.name).toBe("Keep");
    expect(app.id).toBeGreaterThan(0);
  });
});

describe("starter seeding", () => {
  it("seeds homelab categories and is idempotent (no duplicates)", () => {
    const first = seedFromTemplate("homelab");
    expect(first.categoriesCreated).toBe(5);
    expect(first.categoriesSkipped).toBe(0);
    expect(listCategories()).toHaveLength(5);

    const second = seedFromTemplate("homelab");
    expect(second.categoriesCreated).toBe(0);
    expect(second.categoriesSkipped).toBe(5);
    expect(listCategories()).toHaveLength(5); // still 5, no duplicates
  });

  it("does not overwrite a user-created category with the same name", () => {
    const media = createCategory({ name: "Media" });
    const result = seedFromTemplate("homelab");
    expect(result.categoriesSkipped).toBe(1); // Media skipped
    expect(result.categoriesCreated).toBe(4);
    expect(listCategories()).toHaveLength(5);
    // the original Media category is untouched (same id)
    expect(listCategories().find((c) => c.name === "Media")?.id).toBe(media.id);
  });

  it("blank template seeds nothing", () => {
    const result = seedFromTemplate("blank");
    expect(result.categoriesCreated).toBe(0);
    expect(listCategories()).toHaveLength(0);
  });

  it("seeding works regardless of completion state", () => {
    completeSetup();
    const result = seedFromTemplate("homelab");
    expect(result.categoriesCreated).toBe(5);
  });
});
