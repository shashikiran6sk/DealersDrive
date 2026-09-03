import { afterEach, describe, expect, it } from 'vitest';

import { createHealthRouter } from '../../../../src/modules/health/health.routes.js';
import { beginDraining, resetLifecycle } from '../../../../src/platform/telemetry/lifecycle.js';
import { permissionsOn, routesOf, signaturesOf } from '../../../router-probe.js';

/**
 * Liveness and readiness. Infrastructure probes these, not clients, which is
 * why they sit outside `/v1` and why they must never require a session — a
 * load balancer holds no credentials, and a probe that 401s takes the whole
 * deployment down.
 */

const container = {
  prisma: { $queryRaw: () => Promise.resolve([]) },
} as never;
const router = createHealthRouter(container);

afterEach(() => {
  resetLifecycle();
});

interface Answer {
  status: number;
  body: Record<string, unknown>;
}

/** Drives one probe and captures what it answered. */
async function probe(
  which: '/live' | '/ready',
  overrides: { prisma?: unknown } = {},
): Promise<Answer> {
  const router = createHealthRouter({
    prisma: overrides.prisma ?? { $queryRaw: () => Promise.resolve([]) },
  } as never);

  const route = routesOf(router).find((entry) => entry.path === which);

  return new Promise<Answer>((resolve, reject) => {
    let status = 200;
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      json(body: Record<string, unknown>) {
        resolve({ status, body });
        return res;
      },
    };
    route?.handlers[0]?.(
      {} as never,
      res as never,
      ((error?: unknown) =>
        reject(
          error instanceof Error
            ? error
            : new Error(`a health probe called next(): ${String(error)}`),
        )) as never,
    );
  });
}

describe('the surface', () => {
  it('declares liveness and readiness, and nothing else', () => {
    expect(signaturesOf(router).sort()).toEqual(['GET /live', 'GET /ready'].sort());
  });

  it('is read-only', () => {
    for (const route of routesOf(router)) {
      expect(route.method, route.path).toBe('GET');
    }
  });

  /** A probe carries no credentials; requiring any would fail every deploy. */
  it('requires no permission', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), route.path).toEqual([]);
    }
  });

  it('takes no input', () => {
    for (const { path } of routesOf(router)) {
      expect(path, path).not.toContain(':');
    }
  });
});

describe('the two probes are different questions', () => {
  /**
   * Liveness answers "is this process running" — it must not touch the
   * database, or a database blip would make the orchestrator restart healthy
   * processes. Readiness answers "can this process serve traffic", which does
   * depend on the database.
   */
  it('answers liveness without touching the database', async () => {
    const queried = { count: 0 };
    await probe('/live', {
      prisma: {
        $queryRaw: () => {
          queried.count += 1;
          return Promise.resolve([]);
        },
      },
    });

    expect(queried.count).toBe(0);
  });

  it('checks the database on readiness', async () => {
    const queried = { count: 0 };
    const answer = await probe('/ready', {
      prisma: {
        $queryRaw: () => {
          queried.count += 1;
          return Promise.resolve([]);
        },
      },
    });

    expect(queried.count).toBe(1);
    expect(answer.status).toBe(200);
    expect(answer.body.status).toBe('ok');
  });
});

describe('readiness reports what a deploy needs to know', () => {
  /**
   * A green rollout means the containers answered. It does not mean the *new*
   * containers answered — both old and new return 200. The SHA is the only
   * thing that distinguishes them, which is why promote.yml reads it (§20.3).
   */
  it('names the deployed commit and the environment', async () => {
    const answer = await probe('/ready');

    expect(answer.body).toHaveProperty('version');
    expect(answer.body).toHaveProperty('appEnv');
    expect(answer.body).toHaveProperty('contracts');
  });

  it('names which adapters are live', async () => {
    const answer = await probe('/ready');

    expect(answer.body.drivers).toMatchObject({ storage: 'local' });
  });

  it('is 503 and names the failing dependency when the database is down', async () => {
    const answer = await probe('/ready', {
      prisma: { $queryRaw: () => Promise.reject(new Error('connection refused')) },
    });

    expect(answer.status).toBe(503);
    expect(answer.body.status).toBe('degraded');
    expect(answer.body.checks).toMatchObject({ database: 'down' });
  });

  /**
   * ── Reconstruction note ────────────────────────────────────────────────
   * 'is 503 when the cache is down' lives here in the baseline. The rate
   * limiter reads through the cache on every public request, so a cache that
   * is down is a real degradation even though the limiter itself fails open.
   * The cache is built at F028, which must restore both that test and the
   * probe it asserts.
   */
});

describe('draining', () => {
  /**
   * The whole point of the drain flag. On SIGTERM readiness must fail
   * immediately, so the load balancer stops routing here *before* the listener
   * closes — otherwise every request already in flight, and every one routed in
   * the seconds before the next health check, is met with a connection reset
   * (§20.10).
   */
  it('fails readiness the instant a shutdown begins', async () => {
    beginDraining();

    const answer = await probe('/ready');

    expect(answer.status).toBe(503);
    expect(answer.body.status).toBe('draining');
  });

  it('reports how long it has been draining', async () => {
    beginDraining();

    const answer = await probe('/ready');

    expect(typeof answer.body.drainingForMs).toBe('number');
  });

  /**
   * Liveness must keep passing. A liveness probe that fails during a graceful
   * drain gets the container killed mid-drain, which is the opposite of what
   * the drain is for.
   */
  it('keeps liveness green throughout', async () => {
    beginDraining();

    const answer = await probe('/live');

    expect(answer.status).toBe(200);
    expect(answer.body.status).toBe('ok');
  });

  it('does not probe dependencies once draining — that is not the question', async () => {
    const queried = { count: 0 };
    beginDraining();

    await probe('/ready', {
      prisma: {
        $queryRaw: () => {
          queried.count += 1;
          return Promise.resolve([]);
        },
      },
    });

    expect(queried.count).toBe(0);
  });
});
