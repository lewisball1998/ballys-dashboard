/**
 * Next.js boot hook. Runs once when the server process starts (not at build
 * time, not in the edge runtime). This is where the single-instance engines come
 * up: migrations, module registry, scheduler.
 */
export async function register() {
  // Only run in the Node.js server runtime — never edge, never the browser.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic imports keep the native sqlite module out of non-node bundles.
  const { runMigrations } = await import("@/db/migrate");
  runMigrations();

  const { initializeModules } = await import("@/modules");
  initializeModules();

  const { scheduler } = await import("@/server/scheduler");
  scheduler.start();

  console.log("[boot] Bally's Dashboard engines initialised");
}
