import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import type { Container } from '../../src/container.js';
import { createRoutes } from '../../src/routes.js';

/**
 * One file to read to know the whole surface area of the API — and one file
 * where the three guard chains are visible together:
 *
 *   /v1/…          public, no principal
 *   /v1/auth/…     mixed — sign-in open, `/me` and `/onboarding` guarded
 *   /v1/dealer/…   requireDealer  — dealerId enters the request context here
 *   /v1/admin/…    requireAdmin
 *
 * The mount point *is* the authorization boundary, so what has to be proven is
 * that no dealer or admin path is reachable without passing its guard first.
 *
 * These tests dispatch real requests through the assembled router rather than
 * reading Express's layer internals. That costs nothing here and asks the
 * question the way the runtime asks it: given this URL, did the guard run?
 * A refactor that reorganises the mounts but keeps the boundary intact should
 * not fail this file — and one that leaves a path unguarded should.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The guard questions are asked in full: the `/v1/dealer` and `/v1/admin`
 * chains carry their guard as of F016, whether or not a child router has been
 * mounted under them, and that is exactly the property worth pinning first.
 *
 * What is deferred is every `reached` assertion for a path whose router does
 * not exist yet, and most of the public-surface block, which names eight
 * routes from F026, F029, F076, F085 and F088. Each returns with the feature
 * that mounts it. `GET /v1/catalog/bundle` never returns — decision D1
 * removed it.
 * ────────────────────────────────────────────────────────────────────────────
 */

interface Dispatch {
  dealerGuard: boolean;
  signedInGuard: boolean;
  adminGuard: boolean;
  /** A handler ran — including one that then rejected its input. */
  reached: boolean;
}

function harness() {
  const calls = { dealer: 0, signedIn: 0, admin: 0 };

  const requireDealer = (_req: Request, _res: Response, next: () => void) => {
    calls.dealer += 1;
    next();
  };
  const requireSignedIn = (_req: Request, _res: Response, next: () => void) => {
    calls.signedIn += 1;
    next();
  };
  const requireAdmin = (_req: Request, _res: Response, next: () => void) => {
    calls.admin += 1;
    next();
  };

  /**
   * Every service is a Proxy that answers any method with a promise. The
   * handlers are reached but do no work, so a route can be dispatched without
   * a database — and a missing stub cannot make a guard test pass by throwing
   * before the guard runs.
   */
  const service = new Proxy({}, { get: () => () => Promise.resolve({}) }) as never;

  const container = {
    guards: { requireDealer, requireSignedIn, requireAdmin },
    // Pass-through: this file is about which guard chain a path lands on, and
    // a limiter that actually counted would make the assertion depend on how
    // many times the suite dispatched the same URL.
    rateLimit: () => (_req: Request, _res: Response, next: () => void) => {
      next();
    },
    auth: service,
    prisma: { $queryRaw: () => Promise.resolve([]) },
  } as unknown as Container;

  const routes = createRoutes(container);

  /**
   * Express 5 unwinds a nested router asynchronously, so the final `next` —
   * the one that says "nothing matched" — arrives well after the synchronous
   * call returns, and deeper mounts take more turns than shallow ones.
   * Draining the queue is what makes "nothing matched" distinguishable from
   * "a handler is still working".
   */
  async function dispatch(method: string, url: string): Promise<Dispatch> {
    calls.dealer = 0;
    calls.signedIn = 0;
    calls.admin = 0;
    let unmatched = false;

    const req = {
      method,
      url,
      originalUrl: url,
      baseUrl: '',
      path: url.split('?')[0],
      query: {},
      body: {},
      params: {},
      headers: {},
      get: () => undefined,
    } as unknown as Request;

    const res = new Proxy({} as Response, {
      get: (_target, key) => {
        if (key === 'headersSent') return false;
        return () => res;
      },
    });

    routes(req, res, (error?: unknown) => {
      // An error means a handler ran and refused its input — reached, not missing.
      if (error === undefined) unmatched = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    return {
      dealerGuard: calls.dealer > 0,
      signedInGuard: calls.signedIn > 0,
      adminGuard: calls.admin > 0,
      reached: !unmatched,
    };
  }

  return { dispatch };
}

const { dispatch } = harness();

describe('the dealer boundary', () => {
  /**
   * The property the whole tenant model rests on. `requireDealer` is what puts
   * a real `dealerId` into the request context; a console path that skipped it
   * would reach a service with no tenant at all.
   */
  it.each([
    'GET /v1/dealer',
    'GET /v1/dealer/vehicles',
    'POST /v1/dealer/vehicles',
    'GET /v1/dealer/dashboard',
    'GET /v1/dealer/documents',
    'GET /v1/dealer/enquiries',
    'GET /v1/dealer/billing/summary',
    'POST /v1/dealer/media/presign',
  ])('runs requireDealer for %s', async (signature) => {
    const [method, url] = signature.split(' ') as [string, string];

    expect((await dispatch(method, url)).dealerGuard).toBe(true);
  });

  /**
   * `/v1/auth/me` is behind `requireSignedIn`, not `requireDealer`: it has to
   * answer for a verified Google account that has not created a dealership yet.
   * That is a weaker guard, so what matters is that it is still a guard.
   */
  it.each(['GET /v1/auth/me', 'POST /v1/auth/onboarding', 'POST /v1/auth/logout'])(
    'runs the signed-in guard for %s',
    async (signature) => {
      const [method, url] = signature.split(' ') as [string, string];

      expect((await dispatch(method, url)).signedInGuard).toBe(true);
    },
  );

  /**
   * The other half, and the one that would be a lockout rather than a leak:
   * sign-in cannot require being signed in.
   */
  it.each([
    'GET /v1/auth/providers',
    'GET /v1/auth/google/start',
    'GET /v1/auth/google/callback',
    'POST /v1/auth/admin/login',
    'POST /v1/auth/admin/logout',
  ])('leaves %s reachable without any session', async (signature) => {
    const [method, url] = signature.split(' ') as [string, string];
    const result = await dispatch(method, url);

    expect(result.signedInGuard).toBe(false);
    expect(result.dealerGuard).toBe(false);
    expect(result.adminGuard).toBe(false);
  });

  it('never runs the admin guard on a dealer path', async () => {
    expect((await dispatch('GET', '/v1/dealer/vehicles')).adminGuard).toBe(false);
  });

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────
   * `it('reaches the handler once the guard has run')` is not here: no child
   * router is mounted under `/v1/dealer` yet, so nothing can be reached. It
   * returns with the first one — F046's `dealers.routes.ts`.
   */
});

describe('the admin boundary', () => {
  it.each([
    'GET /v1/admin/metrics/overview',
    'GET /v1/admin/dealers',
    'GET /v1/admin/listings',
    'GET /v1/admin/payments',
    'GET /v1/admin/config',
    'GET /v1/admin/audit-logs',
  ])('runs requireAdmin for %s', async (signature) => {
    const [method, url] = signature.split(' ') as [string, string];

    expect((await dispatch(method, url)).adminGuard).toBe(true);
  });

  /** Resolving a dealer principal on an admin path would be the wrong identity entirely. */
  it('never runs the dealer guard on an admin path', async () => {
    expect((await dispatch('GET', '/v1/admin/dealers')).dealerGuard).toBe(false);
  });
});

describe('the public surface', () => {
  /**
   * Deliberately unguarded. `/v1/dealers` is one character from `/v1/dealer`
   * and is the *public* directory — a prefix mount that conflated them would
   * put the anonymous catalogue behind a 401, or worse, the console in front
   * of it.
   */
  /*
   * ── Reconstruction slice ──────────────────────────────────────────────
   * The baseline lists eight public paths. `GET /v1/config/public` is now
   * mounted (F029) and asserted reachable below; the rest belong to F026,
   * F076, F085 and F088 and return with them. `GET /v1/catalog/bundle` does
   * not return at all — decision D1. The unmounted paths kept here are the
   * ones the *existing* mounts could plausibly swallow, `/v1/dealers` above
   * all.
   */
  it.each(['GET /v1/config/public', 'GET /v1/dealers', 'GET /v1/vehicles', 'GET /v1/cities'])(
    'runs no guard for %s',
    async (signature) => {
      const [method, url] = signature.split(' ') as [string, string];
      const result = await dispatch(method, url);

      expect(result.dealerGuard, signature).toBe(false);
      expect(result.adminGuard, signature).toBe(false);
      expect(result.signedInGuard, signature).toBe(false);
    },
  );

  /**
   * Mounted *before* the auth routers, and this is what proves the order does
   * not matter for it: a public path must be reachable with no session, and a
   * mount that fell through to `/v1/auth`'s guarded half would 401 instead.
   */
  it('reaches the public config handler', async () => {
    expect((await dispatch('GET', '/v1/config/public')).reached).toBe(true);
  });
});

describe('what sits outside /v1', () => {
  /**
   * Infrastructure probes `/health`, not clients. Under `/v1` a version bump
   * would need the load balancer reconfigured with it, which is how a routine
   * deploy takes a service down.
   */
  it.each(['/health/live', '/health/ready'])('serves %s unversioned and unguarded', async (url) => {
    const result = await dispatch('GET', url);

    expect(result.reached).toBe(true);
    expect(result.dealerGuard).toBe(false);
    expect(result.adminGuard).toBe(false);
  });

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────
   * `PUT /uploads` is not mounted: F032 landed the adapter that presigns
   * against it, F033 brings `createStorageRouter`. Its case returns there.
   */

  /** Built 7 times to be served 0 times is waste, so the suite turns it off. */
  it('does not mount the docs router under test', async () => {
    expect((await dispatch('GET', '/api/docs/openapi.json')).reached).toBe(false);
  });
});

describe('unmatched paths', () => {
  it('falls through rather than matching something adjacent', async () => {
    expect((await dispatch('GET', '/v1/nope')).reached).toBe(false);
    expect((await dispatch('GET', '/v2/vehicles')).reached).toBe(false);
  });

  /** A typo under the console must still hit the guard before it 404s. */
  it('still runs the dealer guard for an unmatched console path', async () => {
    const result = await dispatch('GET', '/v1/dealer/nope');

    expect(result.dealerGuard).toBe(true);
    expect(result.reached).toBe(false);
  });
});
