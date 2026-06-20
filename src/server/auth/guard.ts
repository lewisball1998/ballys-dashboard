import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { err, type AuthStatusDTO } from "@/lib/types";
import { getSettings } from "@/server/services/settings";
import { adminExists } from "./users";
import { readSessionToken, validateSessionToken } from "./session";

/** Recovery escape hatch (read live so it can be toggled without rebuild). */
function authDisabled(): boolean {
  return process.env.AUTH_DISABLE === "1" || process.env.AUTH_DISABLE === "true";
}

/**
 * Auth is *actively enforced* only when: not disabled, enabled in settings, AND
 * an admin user exists. The last condition prevents lockout in the bootstrap
 * state (enabled but no admin yet) — see needsAdmin in the status.
 */
export function isAuthActive(): boolean {
  if (authDisabled()) return false;
  return getSettings().authEnabled && adminExists();
}

export function getSessionUser(req: NextRequest): { userId: number; username: string } | null {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = validateSessionToken(token);
  if (!session) return null;
  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  return user ? { userId: user.id, username: user.username } : null;
}

export function getAuthStatus(req: NextRequest): AuthStatusDTO {
  const authEnabled = getSettings().authEnabled;
  const user = getSessionUser(req);
  return {
    authEnabled,
    authenticated: user !== null,
    needsAdmin: authEnabled && !authDisabled() && !adminExists(),
    username: user?.username ?? null,
  };
}

function unauthorized(): NextResponse {
  return NextResponse.json(err("unauthenticated", "Authentication required"), { status: 401 });
}

/** 401 if auth is active and the request is not authenticated; otherwise null. */
export function requireApiAuth(req: NextRequest): NextResponse | null {
  if (!isAuthActive()) return null;
  return getSessionUser(req) ? null : unauthorized();
}

/** Setup routes are open during first-run; protected once setup is complete. */
export function requireSetupAuth(req: NextRequest): NextResponse | null {
  if (!getSettings().setupCompleted) return null;
  return requireApiAuth(req);
}
