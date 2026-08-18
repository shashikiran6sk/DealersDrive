import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JOB_NAMES, createInlineQueue } from '../../../../src/platform/jobs/queue.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';

/**
 * Unit tests for `src/platform/jobs/queue.ts`.
 *
 * The integration suite runs entirely on the inline queue (`JOBS_ENABLED=false`),
 * so the pg-boss branch — priorities, retry policy, the deferred `work()`
 * registration that pg-boss v12 requires — is never executed there. That branch
 * is most of this file, and it is where a mistake would be invisible until
 * production, so it is driven here against a fake PgBoss.
 */
interface SentJob {
  name: string;
  data: Record<string, unknown>;
  options: { priority?: number; retryLimit?: number; retryBackoff?: boolean };
}

const boss = {
  sent: [] as SentJob[],
  created: [] as string[],
  workers: [] as {
    name: string;
    handler: (jobs: { data: Record<string, unknown> }[]) => Promise<void>;
  }[],
  schedules: [] as { name: string; cron: string; data: unknown; options: unknown }[],
  errorListeners: [] as ((error: unknown) => void)[],
  starts: 0,
  stops: [] as unknown[],
  reset() {
    this.sent = [];
    this.created = [];
    this.workers = [];
    this.schedules = [];
    this.errorListeners = [];
    this.starts = 0;
    this.stops = [];
  },
};

vi.mock('pg-boss', () => ({
  PgBoss: class {
    constructor(public options: unknown) {}

    on(event: string, listener: (error: unknown) => void) {
      if (event === 'error') boss.errorListeners.push(listener);
    }

    send(name: string, data: Record<string, unknown>, options: SentJob['options']) {
      boss.sent.push({ name, data, options });
      return Promise.resolve('job-id');
    }

    work(name: string, handler: (jobs: { data: Record<string, unknown> }[]) => Promise<void>) {
      boss.workers.push({ name, handler });
      return Promise.resolve('worker-id');
    }

    schedule(name: string, cron: string, data: unknown, options: unknown) {
      boss.schedules.push({ name, cron, data, options });
      return Promise.resolve();
    }

    createQueue(name: string) {
      boss.created.push(name);
      return Promise.resolve();
    }

    start() {
      boss.starts += 1;
      return Promise.resolve(this);
    }

    stop(options: unknown) {
      boss.stops.push(options);
      return Promise.resolve();
    }
  },
}));

/**
 * Builds a pg-boss-backed queue, with `JOBS_ENABLED` on for the module graph.
 *
 * `resetModules` is what makes the flag take effect — `env` is read once at
 * import — and it also means the queue holds a *fresh* logger instance. Anything
 * asserting on log output has to spy on the logger from the same reset graph,
 * which is why this returns it.
 */
async function pgBossQueue() {
  vi.stubEnv('JOBS_ENABLED', 'true');
  vi.resetModules();
  const { createQueue } = await import('../../../../src/platform/jobs/queue.js');
  const { logger: scoped } = await import('../../../../src/platform/telemetry/logger.js');
  return { queue: createQueue(), logger: scoped };
}

beforeEach(() => {
  boss.reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('JOB_NAMES', () => {
  it('is unique and namespaced by subsystem', () => {
    expect(new Set(JOB_NAMES).size).toBe(JOB_NAMES.length);

    for (const name of JOB_NAMES) {
      // pg-boss uses the name as the queue identity, so a rename is a migration.
      expect(name, `${name} should be "subsystem.action"`).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });

  it('covers the four asynchronous concerns the architecture names', () => {
    const prefixes = new Set(JOB_NAMES.map((name) => name.split('.')[0]));

    expect(prefixes).toContain('media');
    expect(prefixes).toContain('search');
    expect(prefixes).toContain('notification');
    expect(prefixes).toContain('listings');
  });
});

describe('createQueue with JOBS_ENABLED=false', () => {
  it('returns the inline queue, so the suite never waits on a poller', async () => {
    vi.stubEnv('JOBS_ENABLED', 'false');
    vi.resetModules();
    const { createQueue } = await import('../../../../src/platform/jobs/queue.js');
    const queue = createQueue();

    const ran: string[] = [];
    await queue.work('search.index-listing', async () => void ran.push('inline'));
    await queue.send('search.index-listing', {});

    // The distinguishing property: the handler has already run by the time
    // `send` resolves. No pg-boss instance was constructed at all.
    expect(ran).toEqual(['inline']);
    expect(boss.sent).toEqual([]);
  });
});

describe('createQueue with JOBS_ENABLED=true', () => {
  it('registers an error listener at construction', async () => {
    await pgBossQueue();

    // A queue that swallows its own transport errors is a queue nobody knows
    // has stopped.
    expect(boss.errorListeners).toHaveLength(1);
  });

  it('logs a pg-boss error rather than crashing the process', async () => {
    const { logger: scoped } = await pgBossQueue();
    const error = vi.spyOn(scoped, 'error').mockImplementation(() => undefined);

    boss.errorListeners[0]?.(new Error('connection reset'));

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[1]).toBe('pg-boss error');
    error.mockRestore();
  });

  it('creates every queue on start, because pg-boss v12 requires it', async () => {
    const { queue } = await pgBossQueue();

    await queue.start();

    expect(boss.starts).toBe(1);
    expect(boss.created).toEqual([...JOB_NAMES]);
  });

  it('defers handlers registered before start, then attaches them all', async () => {
    const { queue } = await pgBossQueue();

    await queue.work('media.process', async () => undefined);
    await queue.work('search.index-listing', async () => undefined);
    expect(boss.workers).toEqual([]);

    await queue.start();

    // The queue has to exist before `work()` can attach to it, so registration
    // order in the container cannot depend on when `start()` is called.
    expect(boss.workers.map((worker) => worker.name)).toEqual([
      'media.process',
      'search.index-listing',
    ]);
  });

  it('attaches immediately for handlers registered after start', async () => {
    const { queue } = await pgBossQueue();
    await queue.start();

    await queue.work('counters.reconcile', async () => undefined);

    expect(boss.workers.map((worker) => worker.name)).toEqual(['counters.reconcile']);
  });

  it('does not re-attach the deferred handlers on a second start', async () => {
    const { queue } = await pgBossQueue();

    await queue.work('media.process', async () => undefined);
    await queue.start();
    await queue.start();

    expect(boss.workers).toHaveLength(1);
  });

  it('runs the handler once per job in a delivered batch', async () => {
    const { queue } = await pgBossQueue();
    const seen: unknown[] = [];

    await queue.work('media.process', async (data) => void seen.push(data));
    await queue.start();
    await boss.workers[0]?.handler([{ data: { mediaId: 'a' } }, { data: { mediaId: 'b' } }]);

    // pg-boss v12 hands over an array; treating it as a single job would silently
    // drop every job after the first.
    expect(seen).toEqual([{ mediaId: 'a' }, { mediaId: 'b' }]);
  });

  it('drops a send issued before start rather than losing it in pg-boss', async () => {
    const { queue } = await pgBossQueue();

    await queue.send('media.process', { mediaId: 'a' });

    // Sending into an unstarted boss throws inside pg-boss; the guard turns a
    // boot-order mistake into a no-op instead of a crash on the first request.
    expect(boss.sent).toEqual([]);
  });

  it('sends with a retry policy, so a transient failure is retried with backoff', async () => {
    const { queue } = await pgBossQueue();
    await queue.start();

    await queue.send('counters.reconcile', { day: '2026-08-17' });

    expect(boss.sent[0]?.options).toMatchObject({ retryLimit: 3, retryBackoff: true });
  });

  it('gives the lead notification the highest priority', async () => {
    const { queue } = await pgBossQueue();
    await queue.start();

    await queue.send('notification.enquiry-to-dealer', { enquiryId: 'a' });
    await queue.send('media.process', { mediaId: 'a' });
    await queue.send('counters.reconcile', {});

    // §14.5: the lead notification is the product. It must not queue behind a
    // reindex.
    const priorities = Object.fromEntries(boss.sent.map((job) => [job.name, job.options.priority]));
    expect(priorities['notification.enquiry-to-dealer']).toBe(100);
    expect(priorities['media.process']).toBe(50);
    expect(priorities['counters.reconcile']).toBe(0);
  });

  it('lets a caller override the priority', async () => {
    const { queue } = await pgBossQueue();
    await queue.start();

    await queue.send('counters.reconcile', {}, { priority: 75 });

    expect(boss.sent[0]?.options.priority).toBe(75);
  });

  it('passes the payload through untouched', async () => {
    const { queue } = await pgBossQueue();
    await queue.start();

    await queue.send('search.index-listing', { listingId: 'abc', reason: 'approved' });

    expect(boss.sent[0]?.data).toEqual({ listingId: 'abc', reason: 'approved' });
  });

  it('schedules in Asia/Kolkata, so a nightly sweep runs at night here', async () => {
    const { queue } = await pgBossQueue();

    await queue.schedule('listings.expire-sweep', '0 2 * * *');

    // A cron in UTC would run the expiry sweep at 07:30 IST, in the middle of
    // the dealer working day.
    expect(boss.schedules[0]).toMatchObject({
      name: 'listings.expire-sweep',
      cron: '0 2 * * *',
      data: {},
      options: { tz: 'Asia/Kolkata' },
    });
  });

  it('passes scheduled data when given it', async () => {
    const { queue } = await pgBossQueue();

    await queue.schedule('counters.reconcile', '*/5 * * * *', { window: 'hour' });

    expect(boss.schedules[0]?.data).toEqual({ window: 'hour' });
  });

  it('stops gracefully, letting in-flight jobs finish', async () => {
    const { queue } = await pgBossQueue();
    await queue.start();

    await queue.stop();

    expect(boss.stops).toEqual([{ graceful: true }]);
  });

  it('stopping before start is a no-op', async () => {
    const { queue } = await pgBossQueue();

    await queue.stop();

    expect(boss.stops).toEqual([]);
  });
});

describe('createInlineQueue', () => {
  it('runs the handler synchronously at send time', async () => {
    const queue = createInlineQueue();
    const order: string[] = [];

    await queue.work('search.index-listing', async () => void order.push('handler'));
    await queue.send('search.index-listing', {});
    order.push('after send');

    // Deliberately not fire-and-forget: a test that submits a listing asserts on
    // what the subscriber wrote on the very next line, with no sleep.
    expect(order).toEqual(['handler', 'after send']);
  });

  it('passes the payload to the handler', async () => {
    const queue = createInlineQueue();
    let received: unknown;

    await queue.work('media.process', async (data) => void (received = data));
    await queue.send('media.process', { mediaId: 'abc' });

    expect(received).toEqual({ mediaId: 'abc' });
  });

  it('ignores a send for a job nobody registered', async () => {
    const queue = createInlineQueue();

    await expect(queue.send('media.gc-orphans', {})).resolves.toBeUndefined();
  });

  it('swallows and logs a handler failure, so the caller is not rolled back', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const queue = createInlineQueue();

    await queue.work('search.index-listing', () => Promise.reject(new Error('index down')));

    await expect(queue.send('search.index-listing', {})).resolves.toBeUndefined();
    expect(error.mock.calls[0]?.[0]).toMatchObject({ job: 'search.index-listing' });
    expect(error.mock.calls[0]?.[1]).toBe('inline job failed');
    error.mockRestore();
  });

  it('keeps the last handler registered for a name', async () => {
    const queue = createInlineQueue();
    const ran: string[] = [];

    await queue.work('media.process', async () => void ran.push('first'));
    await queue.work('media.process', async () => void ran.push('second'));
    await queue.send('media.process', {});

    expect(ran).toEqual(['second']);
  });

  it('treats schedule, start and stop as no-ops', async () => {
    const queue = createInlineQueue();

    await expect(queue.schedule('listings.expire-sweep', '0 2 * * *')).resolves.toBeUndefined();
    await expect(queue.start()).resolves.toBeUndefined();
    await expect(queue.stop()).resolves.toBeUndefined();
  });

  it('does not schedule the sweep into an inline run', async () => {
    const queue = createInlineQueue();
    const ran: string[] = [];

    await queue.work('listings.expire-sweep', async () => void ran.push('swept'));
    await queue.schedule('listings.expire-sweep', '0 2 * * *');

    // A `schedule` that ran the handler would make every test that boots the
    // container expire listings.
    expect(ran).toEqual([]);
  });

  it('keeps handlers per instance', async () => {
    const first = createInlineQueue();
    const second = createInlineQueue();
    const ran: string[] = [];

    await first.work('media.process', async () => void ran.push('first'));
    await second.send('media.process', {});

    expect(ran).toEqual([]);
  });
});
