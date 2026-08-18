import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildContainer,
  closeContainer,
  startBackground,
  type Container,
} from '../../src/container.js';
import type { SessionResolver } from '../../src/modules/auth/session.port.js';
import type { PaymentProvider } from '../../src/platform/payments/payment.port.js';
import type { StoragePort } from '../../src/platform/storage/storage.port.js';

/**
 * The composition root (ARCHITECTURE §5.3). There is no DI framework, so the
 * thing worth asserting is the property the framework would otherwise give
 * you: **the two seams are real.** `sessions` and `payments` can be replaced
 * from outside without touching a module, which is what makes "swapping the
 * dev session resolver for a cookie one is a one-line change" a claim rather
 * than an aspiration.
 *
 * The rest is lifecycle: nothing background starts when jobs are disabled, and
 * `closeContainer` releases everything even when one release fails.
 *
 * Prisma is faked wholesale. Constructing the real client would open a pool,
 * and none of these assertions need a database.
 */

function fakePrisma(): PrismaClient {
  return {
    $disconnect: vi.fn(() => Promise.resolve(undefined)),
    $on: vi.fn(),
    $queryRaw: vi.fn(() => Promise.resolve([])),
  } as unknown as PrismaClient;
}

function fakeQueue() {
  return {
    start: vi.fn(() => Promise.resolve(undefined)),
    stop: vi.fn(() => Promise.resolve(undefined)),
    work: vi.fn(() => Promise.resolve(undefined)),
    send: vi.fn(() => Promise.resolve(undefined)),
    schedule: vi.fn(() => Promise.resolve(undefined)),
  };
}

async function build(overrides: Parameters<typeof buildContainer>[0] = {}) {
  const queue = fakeQueue();
  const container = await buildContainer({
    prisma: fakePrisma(),
    queue: queue,
    ...overrides,
  });
  return { container, queue };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildContainer', () => {
  it('constructs every module the routes need', async () => {
    const { container } = await build();

    for (const key of [
      'env',
      'logger',
      'prisma',
      'queue',
      'bus',
      'outbox',
      'storage',
      'payments',
      'config',
      'sessions',
      'auth',
      'search',
      'searchRepo',
      'catalog',
      'dealers',
      'dealersPublic',
      'vehicles',
      'media',
      'enquiries',
      'billing',
      'admin',
    ] as (keyof Container)[]) {
      expect(container[key], key).toBeDefined();
    }
  });

  it('exposes both guards from the auth middleware', async () => {
    const { container } = await build();

    expect(typeof container.auth.requireDealer).toBe('function');
    expect(typeof container.auth.requireAdmin).toBe('function');
  });

  it('hands the same prisma instance to everything', async () => {
    const prisma = fakePrisma();

    const { container } = await build({ prisma });

    expect(container.prisma).toBe(prisma);
  });

  /**
   * The seam CLAUDE.md §5 names: production auth replaces the *resolver*, and
   * nothing downstream of it knows the difference.
   */
  it('accepts a replacement session resolver', async () => {
    const sessions: SessionResolver = {
      resolveDealer: vi.fn(() => Promise.resolve(null)),
      resolveAdmin: vi.fn(() => Promise.resolve(null)),
    };

    const { container } = await build({ sessions });

    expect(container.sessions).toBe(sessions);
  });

  it('wires the replacement resolver into the guards, not just the field', async () => {
    const resolveDealer = vi.fn(() => Promise.resolve(null));
    const { container } = await build({
      sessions: { resolveDealer, resolveAdmin: vi.fn(() => Promise.resolve(null)) },
    });

    await new Promise<void>((done) => {
      container.auth.requireDealer(
        {} as never,
        {} as never,
        (() => {
          done();
        }) as never,
      );
    });

    expect(resolveDealer).toHaveBeenCalledOnce();
  });

  it('defaults to the development session resolver', async () => {
    const { container } = await build();

    expect(typeof container.sessions.resolveDealer).toBe('function');
    expect(typeof container.sessions.resolveAdmin).toBe('function');
  });

  /** The other seam: Razorpay drops in behind the same interface (§18). */
  it('accepts a replacement payment provider', async () => {
    const payments: PaymentProvider = {
      name: 'razorpay',
      createOrder: vi.fn(() =>
        Promise.resolve({ gatewayOrderId: 'o1', settlement: 'webhook' as const }),
      ),
      verifyClientHandshake: vi.fn(() => true),
    };

    const { container } = await build({ payments });

    expect(container.payments).toBe(payments);
    expect(container.payments.name).toBe('razorpay');
  });

  it('defaults to the development payment provider', async () => {
    const { container } = await build();

    expect(container.payments.name).toBe('development');
  });

  it('accepts a replacement storage adapter', async () => {
    const storage = { name: 'r2' } as unknown as StoragePort;

    const { container } = await build({ storage });

    expect(container.storage).toBe(storage);
  });

  it('accepts a replacement queue', async () => {
    const queue = fakeQueue();

    const { container } = await build({ queue: queue });

    expect(container.queue).toBe(queue);
  });

  /** Every subscriber must be attached before the first request is served. */
  it('registers the job handlers during construction', async () => {
    const { queue } = await build();

    expect(queue.work).toHaveBeenCalled();
  });

  it('does not start anything by itself', async () => {
    const { queue, container } = await build();

    expect(queue.start).not.toHaveBeenCalled();
    expect(container.outbox).toBeDefined();
  });

  /** Without this, serialising any paise column throws "Do not know how to serialize a BigInt". */
  it('makes JSON.stringify safe for bigints', async () => {
    await build();

    expect(JSON.stringify({ paise: 55_000_000n })).toBe('{"paise":55000000}');
  });
});

describe('startBackground', () => {
  it('does nothing at all when jobs are disabled', async () => {
    const { container, queue } = await build();
    const start = vi.spyOn(container.outbox, 'start');

    await startBackground(container);

    expect(queue.start).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  /**
   * The integration suite runs with `JOBS_ENABLED=false` and drains the outbox
   * inline, so this branch is the one that must not leak a poller into a test
   * process.
   */
  it('starts the queue and the outbox poller when jobs are enabled', async () => {
    vi.resetModules();
    vi.stubEnv('JOBS_ENABLED', 'true');
    vi.stubEnv('WORKER_INLINE', 'false');
    vi.stubEnv('WORKER', 'false');

    try {
      const module = await import('../../src/container.js');
      const queue = fakeQueue();
      const container = await module.buildContainer({
        prisma: fakePrisma(),
        queue: queue,
      });
      const outboxStart = vi.spyOn(container.outbox, 'start');

      await module.startBackground(container);

      expect(queue.start).toHaveBeenCalledOnce();
      expect(outboxStart).toHaveBeenCalledOnce();
      expect(queue.schedule).not.toHaveBeenCalled();

      container.outbox.stop();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  /** One image, two process types (§19.1) — only a worker owns the schedules. */
  it('registers the cron schedules only in a worker process', async () => {
    vi.resetModules();
    vi.stubEnv('JOBS_ENABLED', 'true');
    vi.stubEnv('WORKER_INLINE', 'true');

    try {
      const module = await import('../../src/container.js');
      const queue = fakeQueue();
      const container = await module.buildContainer({
        prisma: fakePrisma(),
        queue: queue,
      });

      await module.startBackground(container);

      expect(queue.schedule).toHaveBeenCalled();

      container.outbox.stop();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe('closeContainer', () => {
  it('stops the poller, the queue and the database pool', async () => {
    const { container, queue } = await build();
    const stop = vi.spyOn(container.outbox, 'stop');

    await closeContainer(container);

    expect(stop).toHaveBeenCalledOnce();
    expect(queue.stop).toHaveBeenCalledOnce();
    expect(container.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  /**
   * SIGTERM has a deadline. A queue that refuses to stop must not take the
   * database pool down with it — the process would be killed with connections
   * still checked out.
   */
  it('disconnects the database even when the queue fails to stop', async () => {
    const queue = fakeQueue();
    queue.stop.mockRejectedValueOnce(new Error('pg-boss is wedged'));
    const { container } = await build({ queue: queue });

    await expect(closeContainer(container)).resolves.toBeUndefined();
    expect(container.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('is safe to call when nothing was ever started', async () => {
    const { container } = await build();

    await expect(closeContainer(container)).resolves.toBeUndefined();
  });
});
