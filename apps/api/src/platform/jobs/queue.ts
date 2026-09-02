import { PgBoss } from 'pg-boss';

import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';

/**
 * pg-boss on the database we already run: real queue semantics — retries,
 * backoff, scheduling, dead-lettering, priorities — with zero new
 * infrastructure and transactional enqueue (ARCHITECTURE §19.1).
 *
 * `JOBS_ENABLED=false` swaps in a queue that runs handlers inline. The
 * integration suite uses it so a test never waits on a poller, and so the
 * suite needs no background schema.
 */
export interface Queue {
  send(
    name: JobName,
    data: Record<string, unknown>,
    options?: { priority?: number },
  ): Promise<void>;
  work(name: JobName, handler: (data: Record<string, unknown>) => Promise<void>): Promise<void>;
  schedule(name: JobName, cron: string, data?: Record<string, unknown>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const JOB_NAMES = [
  'media.process',
  'media.gc-orphans',
  'search.index-listing',
  'search.remove-listing',
  'search.reindex-dealer',
  'notification.enquiry-to-dealer',
  'notification.listing-reviewed',
  'notification.dealer-reviewed',
  'notification.invoice',
  'listings.expire-sweep',
  'counters.reconcile',
  'cache.sweep-counters',
  'rc.sweep-lookups',
] as const;

export type JobName = (typeof JOB_NAMES)[number];

/** Highest priority is the lead notification. It is the product (§14.5). */
const PRIORITIES: Partial<Record<JobName, number>> = {
  'notification.enquiry-to-dealer': 100,
  'media.process': 50,
  'search.index-listing': 50,
  'search.remove-listing': 50,
};

export function createQueue(): Queue {
  if (!env.JOBS_ENABLED) return createInlineQueue();

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
  });

  boss.on('error', (error: unknown) => logger.error({ err: error }, 'pg-boss error'));

  /** Handlers registered before `start()`; pg-boss v12 needs the queue to exist. */
  const pending: { name: JobName; handler: (data: Record<string, unknown>) => Promise<void> }[] =
    [];
  let started = false;

  async function attach(
    name: JobName,
    handler: (data: Record<string, unknown>) => Promise<void>,
  ): Promise<void> {
    await boss.work<Record<string, unknown>>(name, async (jobs) => {
      for (const job of jobs) {
        await handler(job.data);
      }
    });
  }

  return {
    async send(name, data, options) {
      if (!started) return;
      await boss.send(name, data, {
        priority: options?.priority ?? PRIORITIES[name] ?? 0,
        retryLimit: 3,
        retryBackoff: true,
      });
    },

    async work(name, handler) {
      if (started) await attach(name, handler);
      else pending.push({ name, handler });
    },

    async schedule(name, cron, data) {
      await boss.schedule(name, cron, data ?? {}, { tz: 'Asia/Kolkata' });
    },

    async start() {
      await boss.start();
      for (const name of JOB_NAMES) {
        await boss.createQueue(name);
      }
      started = true;
      for (const entry of pending) await attach(entry.name, entry.handler);
      pending.length = 0;
    },

    async stop() {
      if (!started) return;
      await boss.stop({ graceful: true });
    },
  };
}

/**
 * Runs every handler synchronously at send time. Deliberately not "fire and
 * forget": a test that submits a listing must be able to assert on what the
 * subscriber wrote, on the next line, without a sleep.
 */
export function createInlineQueue(): Queue {
  const handlers = new Map<JobName, (data: Record<string, unknown>) => Promise<void>>();

  return {
    async send(name, data) {
      const handler = handlers.get(name);
      if (!handler) return;
      try {
        await handler(data);
      } catch (error) {
        logger.error({ err: error, job: name }, 'inline job failed');
      }
    },
    async work(name, handler) {
      handlers.set(name, handler);
      await Promise.resolve();
    },
    async schedule() {
      await Promise.resolve();
    },
    async start() {
      await Promise.resolve();
    },
    async stop() {
      await Promise.resolve();
    },
  };
}
