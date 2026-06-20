import { describe, expect, it } from "vitest";
import type { AppDTO, AppHealthResultDTO, CategoryDTO } from "@/lib/types";
import {
  apiFieldErrors,
  appToForm,
  buildAppPayload,
  emptyAppForm,
  groupAppsByCategory,
  healthLabel,
  healthTone,
  summariseAppHealth,
  validateAppForm,
} from "@/components/launcher/launcher-logic";

function app(partial: Partial<AppDTO>): AppDTO {
  return {
    id: 1,
    categoryId: null,
    name: "App",
    url: "https://a.test",
    icon: null,
    description: null,
    openNewTab: true,
    isFavourite: false,
    authRequired: false,
    healthUrl: null,
    healthEnabled: false,
    isHidden: false,
    lifecycle: "active",
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    latestHealth: null,
    ...partial,
  };
}
function cat(partial: Partial<CategoryDTO>): CategoryDTO {
  return { id: 1, name: "Cat", icon: null, sortOrder: 0, createdAt: "", updatedAt: "", ...partial };
}
function health(status: AppHealthResultDTO["status"]): AppHealthResultDTO {
  return { id: 1, appId: 1, status, statusCode: 200, latencyMs: 5, message: null, checkedAt: "" };
}

describe("health badge mapping", () => {
  it("maps status to tone and label", () => {
    expect(healthTone("up")).toBe("success");
    expect(healthTone("degraded")).toBe("warning");
    expect(healthTone("down")).toBe("error");
    expect(healthTone("unknown")).toBe("neutral");
    expect(healthTone(null)).toBe("neutral");
    expect(healthLabel("up")).toBe("Up");
    expect(healthLabel(undefined)).toBe("Unknown");
  });
});

describe("groupAppsByCategory", () => {
  it("orders categories, pins favourites, and appends uncategorised when present", () => {
    const c1 = cat({ id: 1, name: "A", sortOrder: 1 });
    const c2 = cat({ id: 2, name: "B", sortOrder: 0 });
    const apps = [
      app({ id: 10, categoryId: 1, sortOrder: 1 }),
      app({ id: 11, categoryId: 1, sortOrder: 0, isFavourite: true }),
      app({ id: 12, categoryId: null }),
    ];
    const groups = groupAppsByCategory(apps, [c1, c2]);
    expect(groups[0]?.category?.id).toBe(2); // sortOrder 0 first
    expect(groups[0]?.apps).toEqual([]); // empty category kept
    expect(groups[1]?.category?.id).toBe(1);
    expect(groups[1]?.apps.map((a) => a.id)).toEqual([11, 10]); // favourite pinned first
    expect(groups[2]?.category).toBeNull();
    expect(groups[2]?.apps.map((a) => a.id)).toEqual([12]);
  });

  it("omits the uncategorised section when there are no uncategorised apps", () => {
    const groups = groupAppsByCategory([app({ id: 1, categoryId: 1 })], [cat({ id: 1 })]);
    expect(groups.some((g) => g.category === null)).toBe(false);
  });
});

describe("summariseAppHealth", () => {
  it("counts only health-enabled apps, treating missing health as unknown", () => {
    const summary = summariseAppHealth([
      app({ healthEnabled: true, latestHealth: health("up") }),
      app({ healthEnabled: true, latestHealth: health("down") }),
      app({ healthEnabled: true, latestHealth: null }),
      app({ healthEnabled: false }),
    ]);
    expect(summary).toMatchObject({ total: 4, monitored: 3, up: 1, down: 1, unknown: 1, degraded: 0 });
  });
});

describe("app form payload + validation", () => {
  it("trims and maps empty optional strings to null", () => {
    const payload = buildAppPayload({
      ...emptyAppForm(),
      name: "  My App  ",
      url: "https://x.test",
      description: "",
      icon: "",
      healthUrl: "",
    });
    expect(payload.name).toBe("My App");
    expect(payload.description).toBeNull();
    expect(payload.icon).toBeNull();
    expect(payload.healthUrl).toBeNull();
  });

  it("accepts a valid form and rejects bad url / empty name", () => {
    expect(validateAppForm({ ...emptyAppForm(), name: "X", url: "https://x.test" }).success).toBe(true);

    const badUrl = validateAppForm({ ...emptyAppForm(), name: "X", url: "not-a-url" });
    expect(badUrl.success).toBe(false);
    if (!badUrl.success) expect(badUrl.fieldErrors.url?.length).toBeGreaterThan(0);

    const noName = validateAppForm({ ...emptyAppForm(), name: "", url: "https://x.test" });
    expect(noName.success).toBe(false);
    if (!noName.success) expect(noName.fieldErrors.name?.length).toBeGreaterThan(0);
  });

  it("appToForm fills strings (no nulls) for the form", () => {
    const form = appToForm(
      app({ name: "N", description: "d", icon: "i", healthUrl: "https://h.test", categoryId: 3 }),
    );
    expect(form.description).toBe("d");
    expect(form.icon).toBe("i");
    expect(form.healthUrl).toBe("https://h.test");
    expect(form.categoryId).toBe(3);
  });

  it("apiFieldErrors passes server fields through", () => {
    expect(apiFieldErrors({ url: ["bad"] }).url).toEqual(["bad"]);
    expect(apiFieldErrors(undefined)).toEqual({});
  });
});
