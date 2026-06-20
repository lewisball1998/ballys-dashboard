import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "./index";

let migrated = false;

/**
 * Apply pending migrations. Idempotent and safe to call once at boot
 * (see instrumentation.ts). Resolves the DB lazily via getDb() so this never
 * opens SQLite at import time. The migrations folder is committed to the repo
 * and copied into the Docker image so it is present at runtime.
 */
export function runMigrations(): void {
  if (migrated) return;
  const migrationsFolder = resolve(process.cwd(), "src/db/migrations");
  migrate(getDb(), { migrationsFolder });
  migrated = true;
}
