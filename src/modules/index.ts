import { registry } from "./registry";
import { coreModule } from "./core";

let initialized = false;

/**
 * Register built-in modules. Called once at boot (instrumentation.ts). v0.2 adds
 * dynamic registration of user-enabled modules (e.g. Docker) here.
 */
export function initializeModules(): void {
  if (initialized) return;
  if (!registry.has(coreModule.id)) {
    registry.register(coreModule);
  }
  initialized = true;
}

export { registry };
export * from "./types";
