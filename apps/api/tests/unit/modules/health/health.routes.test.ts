import { describe, expect, it } from 'vitest';

import { createHealthRouter } from '../../../../src/modules/health/health.routes.js';
import { permissionsOn, routesOf, signaturesOf } from '../../../router-probe.js';

/**
 * Liveness and readiness. Infrastructure probes these, not clients, which is
 * why they sit outside `/v1` and why they must never require a session — a
 * load balancer holds no credentials, and a probe that 401s takes the whole
 * deployment down.
 */

const container = { prisma: { $queryRaw: () => Promise.resolve([]) } } as never;
const router = createHealthRouter(container);

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
   * database, or a database blip would make Kubernetes restart healthy
   * processes. Readiness answers "can this process serve traffic", which does
   * depend on the database.
   */
  it('answers liveness without touching the database', async () => {
    const queried = { count: 0 };
    const probeRouter = createHealthRouter({
      prisma: {
        $queryRaw: () => {
          queried.count += 1;
          return Promise.resolve([]);
        },
      },
    } as never);

    const live = routesOf(probeRouter).find((route) => route.path === '/live');
    await new Promise<void>((done) => {
      live?.handlers[0]?.(
        {} as never,
        { json: () => done(), status: () => ({ json: () => done() }) } as never,
        (() => done()) as never,
      );
    });

    expect(queried.count).toBe(0);
  });

  it('checks the database on readiness', async () => {
    const queried = { count: 0 };
    const probeRouter = createHealthRouter({
      prisma: {
        $queryRaw: () => {
          queried.count += 1;
          return Promise.resolve([]);
        },
      },
    } as never);

    const ready = routesOf(probeRouter).find((route) => route.path === '/ready');
    await new Promise<void>((done) => {
      const finish = () => {
        done();
        return undefined as never;
      };
      ready?.handlers[0]?.(
        {} as never,
        { json: finish, status: () => ({ json: finish }) } as never,
        (() => done()) as never,
      );
    });

    expect(queried.count).toBe(1);
  });
});
