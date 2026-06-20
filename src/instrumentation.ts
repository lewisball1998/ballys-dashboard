/**
 * Next.js boot hook. Runs once when the server process starts (not at build
 * time, not in the edge runtime). The actual work lives in a separate Node-only
 * module that is dynamically imported behind the runtime guard, so native
 * dependencies (better-sqlite3 → `fs`) never enter the Edge-runtime bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerNode } = await import("./instrumentation-node");
  registerNode();
}
