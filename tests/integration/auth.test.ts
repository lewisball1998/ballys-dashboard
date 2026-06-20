import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, categories, notifications, sessions, settings, users } from "@/db/schema";
import { route, protectedRoute, jsonOk } from "@/server/api/respond";
import { getAuthStatus, isAuthActive, requireSetupAuth } from "@/server/auth/guard";
import { adminExists, createOrUpdateAdmin, verifyLogin } from "@/server/auth/users";
import {
  cleanupExpiredSessions,
  createSession,
  revokeSessionToken,
  validateSessionToken,
} from "@/server/auth/session";
import { getSettings, updateSettings } from "@/server/services/settings";
import { completeSetup } from "@/server/services/setup";

beforeAll(() => runMigrations());
beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(categories).run();
  db.delete(notifications).run();
  db.delete(sessions).run();
  db.delete(users).run();
  db.delete(settings).run();
  delete process.env.AUTH_DISABLE;
});
afterEach(() => {
  delete process.env.AUTH_DISABLE;
});

function makeReq(opts: { method?: string; origin?: string | null; cookie?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== null) headers.origin = opts.origin ?? "http://localhost:3000";
  if (opts.cookie) headers.cookie = opts.cookie;
  return new NextRequest("http://localhost:3000/api/x", { method: opts.method ?? "GET", headers });
}

describe("admin user + login", () => {
  it("creates a single admin and verifies login", () => {
    createOrUpdateAdmin("admin", "password123");
    expect(adminExists()).toBe(true);
    expect(verifyLogin("admin", "password123")?.username).toBe("admin");
    expect(verifyLogin("admin", "wrong")).toBeNull();
    expect(verifyLogin("nobody", "password123")).toBeNull();
  });

  it("updates the existing admin rather than creating a second", () => {
    createOrUpdateAdmin("admin", "password123");
    createOrUpdateAdmin("admin2", "newpassword");
    expect(db.select().from(users).all()).toHaveLength(1);
    expect(verifyLogin("admin2", "newpassword")?.username).toBe("admin2");
  });
});

describe("sessions", () => {
  it("creates, validates, and revokes a session", () => {
    const user = createOrUpdateAdmin("admin", "password123");
    const { token } = createSession(user.id);
    expect(validateSessionToken(token)?.userId).toBe(user.id);
    revokeSessionToken(token);
    expect(validateSessionToken(token)).toBeNull();
  });

  it("cleans up expired sessions and rejects them", () => {
    const user = createOrUpdateAdmin("admin", "password123");
    const { token } = createSession(user.id);
    db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).run();
    expect(cleanupExpiredSessions()).toBeGreaterThanOrEqual(1);
    expect(validateSessionToken(token)).toBeNull();
  });
});

describe("isAuthActive / getAuthStatus", () => {
  it("is inactive until an admin exists, then active", () => {
    expect(getSettings().authEnabled).toBe(true); // default
    expect(isAuthActive()).toBe(false); // no admin yet (bootstrap)
    createOrUpdateAdmin("admin", "password123");
    expect(isAuthActive()).toBe(true);
  });

  it("is inactive when authEnabled=false or AUTH_DISABLE=1", () => {
    createOrUpdateAdmin("admin", "password123");
    updateSettings({ authEnabled: false });
    expect(isAuthActive()).toBe(false);
    updateSettings({ authEnabled: true });
    expect(isAuthActive()).toBe(true);
    process.env.AUTH_DISABLE = "1";
    expect(isAuthActive()).toBe(false);
  });

  it("reports needsAdmin in the bootstrap state and username when authed", () => {
    const status = getAuthStatus(makeReq());
    expect(status).toMatchObject({ authEnabled: true, authenticated: false, needsAdmin: true });
    const user = createOrUpdateAdmin("admin", "password123");
    const { token } = createSession(user.id);
    const authed = getAuthStatus(makeReq({ cookie: `bd_session=${token}` }));
    expect(authed).toMatchObject({ authenticated: true, needsAdmin: false, username: "admin" });
  });
});

describe("setup auth", () => {
  it("creates the admin and enables auth on complete", () => {
    completeSetup({ auth: { username: "admin", password: "password123" } });
    expect(adminExists()).toBe(true);
    expect(getSettings().authEnabled).toBe(true);
    expect(getSettings().setupCompleted).toBe(true);
    expect(verifyLogin("admin", "password123")?.username).toBe("admin");
  });

  it("disables auth on explicit skip", () => {
    completeSetup({ auth: { skip: true } });
    expect(getSettings().authEnabled).toBe(false);
    expect(getSettings().setupCompleted).toBe(true);
    expect(adminExists()).toBe(false);
  });
});

describe("setup route gating (requireSetupAuth)", () => {
  it("is open before completion and protected after", () => {
    expect(requireSetupAuth(makeReq({ method: "POST" }))).toBeNull(); // first-run open
    completeSetup({ auth: { username: "admin", password: "password123" } }); // completes + activates auth
    const denied = requireSetupAuth(makeReq({ method: "POST" }));
    expect(denied?.status).toBe(401);
  });
});

describe("route() CSRF", () => {
  const handler = route(async () => jsonOk({ ok: true }));

  it("allows GET regardless of origin", async () => {
    expect((await handler(makeReq({ method: "GET", origin: null }), {})).status).toBe(200);
  });
  it("blocks cross-origin unsafe methods", async () => {
    const res = await handler(makeReq({ method: "POST", origin: "http://evil.example" }), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("csrf_failed");
  });
  it("allows same-origin unsafe methods", async () => {
    const res = await handler(makeReq({ method: "POST", origin: "http://localhost:3000" }), {});
    expect(res.status).toBe(200);
  });
  it("blocks unsafe methods with no Origin header", async () => {
    expect((await handler(makeReq({ method: "POST", origin: null }), {})).status).toBe(403);
  });
});

describe("protectedRoute() auth", () => {
  const handler = protectedRoute(async () => jsonOk({ ok: true }));

  it("passes through when auth is inactive (no admin)", async () => {
    const res = await handler(makeReq({ method: "POST", origin: "http://localhost:3000" }), {});
    expect(res.status).toBe(200);
  });

  it("401s when auth active and unauthenticated, 200 with a valid session", async () => {
    const user = createOrUpdateAdmin("admin", "password123"); // auth now active (enabled+admin)
    const noCookie = await handler(makeReq({ method: "POST", origin: "http://localhost:3000" }), {});
    expect(noCookie.status).toBe(401);

    const { token } = createSession(user.id);
    const withCookie = await handler(
      makeReq({ method: "POST", origin: "http://localhost:3000", cookie: `bd_session=${token}` }),
      {},
    );
    expect(withCookie.status).toBe(200);
  });

  it("AUTH_DISABLE=1 bypasses auth (recovery) but CSRF still applies", async () => {
    createOrUpdateAdmin("admin", "password123");
    process.env.AUTH_DISABLE = "1";
    const ok = await handler(makeReq({ method: "POST", origin: "http://localhost:3000" }), {});
    expect(ok.status).toBe(200);
    const csrf = await handler(makeReq({ method: "POST", origin: "http://evil.example" }), {});
    expect(csrf.status).toBe(403);
  });
});
