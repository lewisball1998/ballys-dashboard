import type { ModuleDefinition } from "./types";

/**
 * ⭐ ARCHITECT-OWNED. In-memory module registry. Server-side only (it can hold
 * provider closures that touch sockets/files). Disabled modules contribute
 * nothing — no widgets, no providers, no routes. v0.1 registers core modules
 * only; v0.2 adds Docker.
 */
class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>();

  register(module: ModuleDefinition): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered`);
    }
    this.modules.set(module.id, module);
  }

  get(id: string): ModuleDefinition | undefined {
    return this.modules.get(id);
  }

  has(id: string): boolean {
    return this.modules.has(id);
  }

  list(): ModuleDefinition[] {
    return [...this.modules.values()];
  }

  listCore(): ModuleDefinition[] {
    return this.list().filter((m) => m.isCore);
  }

  clear(): void {
    this.modules.clear();
  }
}

const globalForRegistry = globalThis as unknown as {
  __ballysRegistry?: ModuleRegistry;
};

export const registry = globalForRegistry.__ballysRegistry ?? new ModuleRegistry();
globalForRegistry.__ballysRegistry = registry;

export type { ModuleRegistry };
