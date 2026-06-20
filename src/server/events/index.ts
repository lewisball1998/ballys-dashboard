import type { Severity } from "@/lib/types";

/**
 * Event / notification pipeline — SKELETON.
 *
 * Collectors (Phase 1) emit typed events; the pipeline deduplicates them (so a
 * service that stays down doesn't spam) and fans them out to registered sinks.
 *
 * Phase 0 ships the pipeline + a console sink. Phase 1 adds a DB sink that
 * persists to the `notifications` table, completing the down -> recovered flow.
 */

export interface DashboardEvent {
  /** Stable type, e.g. "app.health.down", "system.threshold.cpu". */
  type: string;
  severity: Severity;
  title: string;
  message?: string;
  source?: string;
  /** Dedupe within a TTL window; defaults to `type` when omitted. */
  dedupeKey?: string;
  data?: Record<string, unknown>;
}

export interface EventSink {
  readonly name: string;
  handle(event: DashboardEvent): Promise<void> | void;
}

class EventPipeline {
  private readonly sinks: EventSink[] = [];
  private readonly recent = new Map<string, number>();
  private dedupeTtlMs = 5 * 60_000;

  addSink(sink: EventSink): void {
    if (!this.sinks.some((s) => s.name === sink.name)) this.sinks.push(sink);
  }

  setDedupeTtl(ms: number): void {
    this.dedupeTtlMs = ms;
  }

  async emit(event: DashboardEvent): Promise<void> {
    const key = event.dedupeKey ?? event.type;
    const now = Date.now();
    const last = this.recent.get(key);
    if (last !== undefined && now - last < this.dedupeTtlMs) return;
    this.recent.set(key, now);
    this.pruneRecent(now);

    await Promise.all(
      this.sinks.map(async (sink) => {
        try {
          await sink.handle(event);
        } catch (error) {
          console.error(`[events] sink "${sink.name}" failed:`, error);
        }
      }),
    );
  }

  /** Clear a dedupe key so a recovery event can fire immediately. */
  resetDedupe(key: string): void {
    this.recent.delete(key);
  }

  private pruneRecent(now: number): void {
    for (const [key, ts] of this.recent) {
      if (now - ts >= this.dedupeTtlMs) this.recent.delete(key);
    }
  }
}

const consoleSink: EventSink = {
  name: "console",
  handle(event) {
    console.log(`[event:${event.severity}] ${event.type} — ${event.title}`);
  },
};

const globalForPipeline = globalThis as unknown as { __ballysEvents?: EventPipeline };
export const events = globalForPipeline.__ballysEvents ?? new EventPipeline();
if (!globalForPipeline.__ballysEvents) {
  events.addSink(consoleSink);
  globalForPipeline.__ballysEvents = events;
}

export type { EventPipeline };
