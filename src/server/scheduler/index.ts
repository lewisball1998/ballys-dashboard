/**
 * Scheduler / collection engine — SKELETON.
 *
 * In-process, single-instance (ADR 0004). Started once at boot via
 * instrumentation.ts with a globalThis singleton guard so it survives Next.js
 * module re-evaluation and dev hot-reloads.
 *
 * Phase 0 ships the engine + registration API only — NO jobs are registered.
 * Phase 1 registers:
 *   - "system-metrics" @ systemMetricIntervalMs  (collect + persist)
 *   - "app-health"     @ appHealthIntervalMs      (check + persist + emit events)
 *   - "metric-retention" (daily trim per retentionDays)
 */

export interface ScheduledJob {
  readonly id: string;
  readonly intervalMs: number;
  /** Optional per-run timeout; defaults to min(intervalMs, 60s). */
  readonly timeoutMs?: number;
  run(signal: AbortSignal): Promise<void>;
}

interface JobEntry {
  job: ScheduledJob;
  timer?: NodeJS.Timeout;
  running: boolean;
}

class Scheduler {
  private readonly jobs = new Map<string, JobEntry>();
  private started = false;

  register(job: ScheduledJob): void {
    if (this.jobs.has(job.id)) {
      throw new Error(`Job "${job.id}" already registered`);
    }
    const entry: JobEntry = { job, running: false };
    this.jobs.set(job.id, entry);
    if (this.started) this.schedule(entry);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const entry of this.jobs.values()) this.schedule(entry);
    console.log(`[scheduler] started with ${this.jobs.size} job(s)`);
  }

  stop(): void {
    for (const entry of this.jobs.values()) {
      if (entry.timer) clearInterval(entry.timer);
      entry.timer = undefined;
    }
    this.started = false;
  }

  /** Run a job immediately (used by the "refresh now" endpoints in Phase 1). */
  async runNow(id: string): Promise<void> {
    const entry = this.jobs.get(id);
    if (!entry) throw new Error(`Unknown job "${id}"`);
    await this.execute(entry);
  }

  private schedule(entry: JobEntry): void {
    if (entry.timer) return;
    entry.timer = setInterval(() => void this.execute(entry), entry.job.intervalMs);
    // Don't keep the event loop alive solely for the scheduler.
    entry.timer.unref?.();
  }

  private async execute(entry: JobEntry): Promise<void> {
    if (entry.running) return; // prevent overlapping runs
    entry.running = true;
    const timeoutMs = entry.job.timeoutMs ?? Math.min(entry.job.intervalMs, 60_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await entry.job.run(controller.signal);
    } catch (error) {
      console.error(`[scheduler] job "${entry.job.id}" failed:`, error);
    } finally {
      clearTimeout(timer);
      entry.running = false;
    }
  }
}

const globalForScheduler = globalThis as unknown as { __ballysScheduler?: Scheduler };
export const scheduler = globalForScheduler.__ballysScheduler ?? new Scheduler();
globalForScheduler.__ballysScheduler = scheduler;

export type { Scheduler };
