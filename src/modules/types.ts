import type { ZodTypeAny } from "zod";
import type { HealthStatus } from "@/lib/types";

/**
 * ⭐ ARCHITECT-OWNED CONTRACT. This is the seam the whole product is built
 * around. In v0.1 the only implementors are *core* providers (local system
 * metrics + app health). In v0.2 the Docker module becomes the first external
 * implementor — without changing anything in this file. Treat changes here as a
 * versioned, broadcast event (see docs/adr/0005).
 */

// --- Provider execution context ----------------------------------------------

export interface ProviderContext {
  /** Abort signal driven by the scheduler's per-job timeout. */
  readonly signal: AbortSignal;
  /** Decrypted, validated module config (empty object for core providers). */
  readonly config: Record<string, unknown>;
  /** Stable instance id ("core" for built-ins; module instance id otherwise). */
  readonly instanceId: string;
}

// --- Health providers --------------------------------------------------------

export interface HealthResult {
  status: HealthStatus;
  latencyMs?: number;
  statusCode?: number;
  message?: string;
  checkedAt: Date;
}

export interface HealthProvider {
  /** Stable id, unique within the module. */
  readonly id: string;
  check(ctx: ProviderContext): Promise<HealthResult>;
}

// --- Metric providers --------------------------------------------------------

export interface MetricPoint {
  /** e.g. "cpu", "memory", "disk:/", "net:eth0". */
  sourceId: string;
  /** e.g. "usage_percent", "bytes_used". */
  metric: string;
  value: number;
  unit?: string;
  recordedAt?: Date;
}

export interface MetricProvider {
  readonly id: string;
  collect(ctx: ProviderContext): Promise<MetricPoint[]>;
}

// --- Actions (defined now, exercised in v0.2: container start/stop/restart) ---

export interface ActionDefinition<P = Record<string, unknown>, R = unknown> {
  readonly id: string;
  readonly label: string;
  /** True for mutating actions; the API layer enforces CSRF on these (v0.2). */
  readonly mutates: boolean;
  run(ctx: ProviderContext, params: P): Promise<R>;
}

// --- Widgets -----------------------------------------------------------------

/**
 * Widgets reference a client component by stable key; the registry never imports
 * React so it stays server-safe. The Frontend agent maps `componentKey` to a
 * concrete component in a client-side widget registry (Phase 1).
 */
export interface WidgetDefinition {
  readonly id: string;
  readonly title: string;
  readonly componentKey: string;
  readonly defaultSize?: { w: number; h: number };
  /**
   * Instanceable widgets are *templates* the user adds explicitly, zero-to-many
   * times, each instance carrying its own `config` (e.g. an app widget bound to
   * an app id). The framework must never auto-place them: they are excluded from
   * the default layout and from reconcile's auto-append. Singleton built-ins
   * leave this falsy and keep their existing auto-place behaviour.
   */
  readonly instanceable?: boolean;
}

// --- Module definition -------------------------------------------------------

export type ModuleCategory =
  | "core"
  | "containers"
  | "storage"
  | "media"
  | "automation"
  | "network"
  | "ai"
  | "other";

export interface ModuleCapabilities {
  health?: HealthProvider[];
  metrics?: MetricProvider[];
  actions?: ActionDefinition[];
  widgets?: WidgetDefinition[];
}

export interface ModuleDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ModuleCategory;
  readonly icon?: string;
  /** Built-ins (system, app health) are always on and cannot be disabled. */
  readonly isCore?: boolean;
  /** Zod schema for instance config; drives the auto-generated settings form. */
  readonly configSchema?: ZodTypeAny;
  /** Config fields encrypted at rest (v0.2 crypto). */
  readonly secretFields?: string[];
  readonly capabilities: ModuleCapabilities;
  /** Hints consumed by the v0.2 setup wizard "environment discovery" step. */
  readonly setupHints?: {
    suggestedWidgets?: string[];
    suggestedSections?: string[];
  };
}
