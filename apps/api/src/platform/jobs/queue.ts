import { PgBoss } from 'pg-boss';

import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';

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
  'notification.email',
  'listings.expire-sweep',
  'counters.reconcile',
  'cache.sweep-counters',
  'rc.sweep-lookups',
] as const;

export type JobName = (typeof JOB_NAMES)[number];

const PRIORITIES: Partial<Record<JobName, number>> = {
  'notification.enquiry-to-dealer': 100,
  'media.process': 50,
  'search.index-listing': 50,
  'search.remove-listing': 50,
};

const RETRY: Partial<Record<JobName, { retryLimit: number; retryDelay: number }>> = {
  'notification.email': { retryLimit: 5, retryDelay: 30 },
};

export function createQueue(): Queue {
  if (!env.JOBS_ENABLED) return createInlineQueue();

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
  });

  boss.on('error', (error: unknown) => logger.error({ err: error }, 'pg-boss error'));

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
        retryLimit: RETRY[name]?.retryLimit ?? 3,
        ...(RETRY[name] ? { retryDelay: RETRY[name].retryDelay } : {}),
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
