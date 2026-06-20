import { describe, expect, it } from "vitest";
import type { AuthStatusDTO } from "@/lib/types";
import {
  apiLoginErrors,
  buildLoginPayload,
  gateDecision,
  loginView,
  validateLogin,
} from "@/components/auth/auth-logic";

const base: AuthStatusDTO = { authEnabled: true, authenticated: false, needsAdmin: false, username: null };

describe("gateDecision", () => {
  it("decides loading / allow / setup / login", () => {
    expect(gateDecision(null)).toBe("loading");
    expect(gateDecision({ ...base, authEnabled: false })).toBe("allow");
    expect(gateDecision({ ...base, needsAdmin: true })).toBe("setup");
    expect(gateDecision(base)).toBe("login");
    expect(gateDecision({ ...base, authenticated: true })).toBe("allow");
  });
});

describe("loginView", () => {
  it("maps status to the login page view", () => {
    expect(loginView(null)).toBe("loading");
    expect(loginView({ ...base, authEnabled: false })).toBe("disabled");
    expect(loginView({ ...base, needsAdmin: true })).toBe("needs-admin");
    expect(loginView({ ...base, authenticated: true })).toBe("authenticated");
    expect(loginView(base)).toBe("form");
  });
});

describe("login form logic", () => {
  it("trims the username in the payload", () => {
    expect(buildLoginPayload({ username: "  admin ", password: "pw" })).toEqual({
      username: "admin",
      password: "pw",
    });
  });

  it("validates required fields", () => {
    expect(validateLogin({ username: "admin", password: "password123" }).success).toBe(true);

    const noUser = validateLogin({ username: "", password: "password123" });
    expect(noUser.success).toBe(false);
    if (!noUser.success) expect(noUser.fieldErrors.username?.length).toBeGreaterThan(0);

    const noPass = validateLogin({ username: "admin", password: "" });
    expect(noPass.success).toBe(false);
    if (!noPass.success) expect(noPass.fieldErrors.password?.length).toBeGreaterThan(0);
  });

  it("passes server field errors through", () => {
    expect(apiLoginErrors({ code: "x", message: "m", fields: { password: ["bad"] } }).password).toEqual(["bad"]);
    expect(apiLoginErrors({ code: "x", message: "m" })).toEqual({});
  });
});
