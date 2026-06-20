import { describe, it, expect } from "vitest";
import { jsonOk, jsonError, parseBody } from "@/server/api/respond";
import { settingsUpdateSchema } from "@/lib/validation";

describe("response helpers", () => {
  it("jsonOk wraps data in the success envelope", async () => {
    const res = jsonOk({ hello: "world" }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("jsonError wraps an error with code/message/fields", async () => {
    const res = jsonError("not_found", "Missing", 404, { id: ["required"] });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not_found");
    expect(body.error.fields).toEqual({ id: ["required"] });
  });
});

describe("parseBody", () => {
  it("accepts a valid partial settings update", () => {
    const result = parseBody(settingsUpdateSchema, { dashboardName: "Lab", theme: "dark" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dashboardName).toBe("Lab");
      expect(result.data.theme).toBe("dark");
    }
  });

  it("rejects an invalid value with a 400 validation_error and field details", async () => {
    const result = parseBody(settingsUpdateSchema, { theme: "neon" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.fields).toHaveProperty("theme");
    }
  });
});
