import { runMigrations } from "./migrate";

/** `pnpm db:migrate` entrypoint — applies migrations from the command line. */
try {
  runMigrations();
  console.log("[db] migrations applied");
  process.exit(0);
} catch (error) {
  console.error("[db] migration failed:", error);
  process.exit(1);
}
