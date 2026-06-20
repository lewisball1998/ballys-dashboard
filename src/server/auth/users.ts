import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { User } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";

// Precomputed hash so verifyLogin spends similar time whether or not the user
// exists (mitigates username enumeration via timing).
const DUMMY_HASH = hashPassword("dummy-password-placeholder");

export function adminExists(): boolean {
  return (db.select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0) > 0;
}

export function getAdmin(): User | undefined {
  return db.select().from(users).orderBy(users.id).limit(1).get();
}

/** Create the single admin, or update its username/password if one exists. */
export function createOrUpdateAdmin(username: string, password: string): User {
  const existing = getAdmin();
  const passwordHash = hashPassword(password);
  if (existing) {
    return db.update(users).set({ username, passwordHash }).where(eq(users.id, existing.id)).returning().get();
  }
  return db.insert(users).values({ username, passwordHash, role: "admin" }).returning().get();
}

export function verifyLogin(username: string, password: string): User | null {
  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user) {
    verifyPassword(password, DUMMY_HASH); // constant-ish time
    return null;
  }
  return verifyPassword(password, user.passwordHash) ? user : null;
}
