import { describe, expect, it } from "vitest";
import {
  buildCompletePayload,
  validateSetupAuth,
  type AppearanceValues,
  type SetupAuthValues,
} from "@/components/setup/setup-logic";

const appearance: AppearanceValues = {
  dashboardName: "Home",
  theme: "dark",
  accent: "blue",
  timezone: "UTC",
  logoPath: "",
};

const createAuth: SetupAuthValues = {
  mode: "create",
  username: "admin",
  password: "password123",
  confirm: "password123",
};

describe("validateSetupAuth", () => {
  it("returns a skip block when skipping", () => {
    const result = validateSetupAuth({ mode: "skip", username: "", password: "", confirm: "" });
    expect(result).toEqual({ success: true, auth: { skip: true } });
  });

  it("returns admin credentials when valid", () => {
    const result = validateSetupAuth(createAuth);
    expect(result).toEqual({ success: true, auth: { username: "admin", password: "password123" } });
  });

  it("flags a password/confirm mismatch", () => {
    const result = validateSetupAuth({ ...createAuth, confirm: "different" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.confirm?.length).toBeGreaterThan(0);
  });

  it("flags a too-short password and empty username", () => {
    const shortPw = validateSetupAuth({ ...createAuth, password: "short", confirm: "short" });
    expect(shortPw.success).toBe(false);
    if (!shortPw.success) expect(shortPw.fieldErrors.password?.length).toBeGreaterThan(0);

    const noUser = validateSetupAuth({ ...createAuth, username: "" });
    expect(noUser.success).toBe(false);
    if (!noUser.success) expect(noUser.fieldErrors.username?.length).toBeGreaterThan(0);
  });
});

describe("buildCompletePayload with auth", () => {
  it("includes the auth block when provided", () => {
    expect(buildCompletePayload(appearance, { skip: true }).auth).toEqual({ skip: true });
    expect(buildCompletePayload(appearance, { username: "admin", password: "password123" }).auth).toEqual({
      username: "admin",
      password: "password123",
    });
  });

  it("omits auth when not provided (backwards-compatible)", () => {
    expect(buildCompletePayload(appearance).auth).toBeUndefined();
  });
});
