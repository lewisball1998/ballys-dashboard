import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { env } from "@/lib/env";

/**
 * SQLite + Drizzle client.
 *
 * The connection is opened **lazily** — nothing touches SQLite at module import
 * time. This is deliberate: `next build` imports API route/service modules to
 * collect their metadata, and if importing those modules opened the database,
 * concurrent build workers would each open the fresh WAL file and intermittently
 * fail with "database is locked". Deferring the open to first real use (a query
 * at runtime) keeps the build from ever creating or touching SQLite.
 *
 * A single connection is reused across the process (and across dev hot-reloads
 * via globalThis) to avoid "database is locked" from multiple WAL writers.
 */
function createDb() {
  // ":memory:" (and file::memory: forms) must be passed through untouched so
  // SQLite uses a true in-memory DB; resolving it would create a real file.
  const raw = env.DATABASE_PATH;
  const isMemory = raw === ":memory:" || raw.startsWith("file::memory:");
  const dbPath = isMemory ? raw : resolve(raw);
  if (!isMemory) mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

export type DB = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __ballysDb?: DB };
let instance: DB | undefined;

/**
 * Lazily create (once) and return the SQLite/Drizzle client. The connection is
 * opened on the first call — never at import time — and cached for the process
 * lifetime (and across dev hot-reloads via globalThis). This is the canonical
 * runtime accessor; call it inside request handlers / service functions.
 */
export function getDb(): DB {
  instance ??= globalForDb.__ballysDb ?? createDb();
  if (env.NODE_ENV !== "production") globalForDb.__ballysDb = instance;
  return instance;
}

/**
 * Back-compat accessor that behaves exactly like the Drizzle client but resolves
 * the (lazy) connection on first property access via {@link getDb}. Existing call
 * sites keep using `db.select()/insert()/transaction()/…` unchanged, and merely
 * *importing* this module still never opens SQLite. Prefer {@link getDb} in new
 * code.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return prop in (getDb() as object);
  },
}) as DB;

export { schema };
