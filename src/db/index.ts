import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { env } from "@/lib/env";

/**
 * SQLite + Drizzle client. A single connection is reused across the process
 * (and across dev hot-reloads via globalThis) to avoid "database is locked"
 * errors from multiple WAL writers.
 */
function createDb() {
  const dbPath = resolve(env.DATABASE_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as {
  __ballysDb?: ReturnType<typeof createDb>;
};

export const db = globalForDb.__ballysDb ?? createDb();
if (env.NODE_ENV !== "production") globalForDb.__ballysDb = db;

export type DB = typeof db;
export { schema };
