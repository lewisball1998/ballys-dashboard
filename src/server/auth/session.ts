import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";

/**
 * Session management. The cookie carries a random token; the DB stores only its
 * sha256, so a DB read cannot mint sessions. 30-day sliding expiry; expired rows
 * are cleaned lazily on validation (plus a boot-time sweep).
 */
export const SESSION_COOKIE = "bd_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, createdAt: new Date() }).run();
  return { token, expiresAt };
}

export function validateSessionToken(token: string): { userId: number; expiresAt: Date } | null {
  const id = hashToken(token);
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }
  // Sliding expiry: extend on use.
  const expiresAt = new Date(Date.now() + TTL_MS);
  db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
  return { userId: row.userId, expiresAt };
}

export function revokeSessionToken(token: string): void {
  db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

export function cleanupExpiredSessions(): number {
  return db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run().changes;
}

export function readSessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export function isHttps(req: NextRequest): boolean {
  return req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date, secure: boolean): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
