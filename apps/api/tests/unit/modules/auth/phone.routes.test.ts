import type { Server } from 'node:http';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PhoneService } from '../../../../src/modules/auth/phone.service.js';
import type { AuthService } from '../../../../src/modules/auth/auth.service.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';

/**
 * The two limits on the phone routes, and the key they count by (**R39**).
 *
 * This is the one control the API still holds over MSG91 spend, and nothing
 * else exercises it: the test project pins `RATE_LIMIT_ENABLED=false` — forty
 * integration tests from one address would otherwise trip every limiter — and
 * `byUser` is the first `keyBy` anywhere under `modules/`. So it is built here
 * with the switch in the position production uses.
 *
 * Two properties, and the second is the one a default limiter would get wrong.
 * **It counts by person, not by address.** A dealership is often one office
 * behind one NAT, and two people signing up from it must not share a bucket —
 * the first would spend the second's allowance and the second would be refused
 * a code they had never asked for.
 *
 * `keyBy` is also the one place in this chain that could throw where nothing
 * would catch it: `createRateLimiter` runs it inside a `void (async () => …)`,
 * so a throw would be an unhandled rejection and a request that never answers.
 * It cannot throw here — the guard runs first and sets the principal — and
 * these cases are what keeps that true.
 */
const PRINCIPAL = { kind: 'PENDING' as const, permissions: [] as string[] };

function phoneService(): PhoneService {
  return {
    widget: () => ({
      enabled: true,
      driver: 'fake' as const,
      widgetId: null,
      tokenAuth: null,
      devCode: '123456',
      reason: null,
    }),
    assertAvailable: () => Promise.resolve(),
    verify: () =>
      Promise.resolve({
        phone: '+919840012345',
        phoneDisplay: '+91 98400 12345',
        verifiedAt: new Date().toISOString(),
      }),
  };
}

/**
 * The router with the limiter switched on, behind a stand-in for
 * `requireSignedIn` that resolves whichever user the request asks to be.
 */
async function appFor(userId: string | (() => string)) {
  vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
  vi.resetModules();

  const { createRateLimiter } = await import('../../../../src/middleware/rate-limit.js');
  const { createSessionAuthRouter } = await import('../../../../src/modules/auth/auth.routes.js');
  const { errorHandler } = await import('../../../../src/middleware/error-handler.js');
  vi.unstubAllEnvs();

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // What `requireSignedIn` puts there. The router reads it through
    // `signedInPrincipal`, which is what `byUser` is built on.
    req.principal = {
      ...PRINCIPAL,
      userId: typeof userId === 'function' ? userId() : userId,
      email: null,
      fullName: null,
      phone: null,
      phoneVerified: false,
    };
    next();
  });
  app.use(
    '/v1/auth',
    createSessionAuthRouter(
      {} as AuthService,
      phoneService(),
      createRateLimiter(createMemoryCache()),
    ),
  );
  app.use(errorHandler);

  /*
   * One listener for the file, not one per request (CONTEXT.md §7l).
   *
   * `request(app)` calls `app.listen(0)` and closes it again when the request
   * ends, so thirty-one requests are thirty-one ephemeral ports handed back to
   * the operating system — and on a machine with other servers on it, one of
   * them can be taken between requests and the next call dials a stranger.
   */
  const server = app.listen(0);
  servers.push(server);
  return server;
}

/** Closed in `afterEach`, so a file of these does not leak listeners. */
const servers: Server[] = [];

const BODY = { phone: '9840012345', accessToken: 'dev-otp:919840012345:123456' };

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        }),
    ),
  );
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the widget configuration is rate-limited', () => {
  it('allows thirty an hour and refuses the thirty-first', async () => {
    const app = await appFor('user-1');

    for (let call = 0; call < 30; call += 1) {
      await request(app).get('/v1/auth/phone/widget').expect(200);
    }

    const refused = await request(app).get('/v1/auth/phone/widget').expect(429);
    expect(refused.body.code).toBe('PHONE_OTP_RATE_LIMITED');
  });
});

describe('verification is rate-limited', () => {
  it('allows ten presentations and refuses the eleventh', async () => {
    const app = await appFor('user-1');

    for (let call = 0; call < 10; call += 1) {
      await request(app).post('/v1/auth/phone/verify').send(BODY).expect(200);
    }

    const refused = await request(app).post('/v1/auth/phone/verify').send(BODY).expect(429);
    expect(refused.body.code).toBe('PHONE_OTP_RATE_LIMITED');
    expect(refused.headers['retry-after']).toBeDefined();
  });

  /**
   * The reason `keyBy` exists at all. A dealership is often one office behind
   * one address; counting by it would let the first person through it spend
   * the second's allowance.
   */
  it('counts per person, so one office does not share a bucket', async () => {
    let current = 'user-1';
    const app = await appFor(() => current);

    for (let call = 0; call < 10; call += 1) {
      await request(app).post('/v1/auth/phone/verify').send(BODY).expect(200);
    }
    await request(app).post('/v1/auth/phone/verify').send(BODY).expect(429);

    current = 'user-2';
    await request(app).post('/v1/auth/phone/verify').send(BODY).expect(200);
  });

  /** And the limits are separate counters, not one shared allowance. */
  it('does not spend the verify allowance on reading the configuration', async () => {
    const app = await appFor('user-1');

    for (let call = 0; call < 20; call += 1) {
      await request(app).get('/v1/auth/phone/widget').expect(200);
    }

    await request(app).post('/v1/auth/phone/verify').send(BODY).expect(200);
  });
});
