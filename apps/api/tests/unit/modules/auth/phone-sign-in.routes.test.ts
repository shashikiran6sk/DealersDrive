import type { Server } from 'node:http';

import express, { type Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthService } from '../../../../src/modules/auth/auth.service.js';
import type { CustomerAuthService } from '../../../../src/modules/auth/customer-auth.service.js';
import type { PhoneSignInService } from '../../../../src/modules/auth/phone-sign-in.service.js';
import { byClaimedPhone, byIp } from '../../../../src/modules/auth/routes/phone-sign-in-limit.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';

/**
 * The limits on phone sign-in (**R60**).
 *
 * There is no session to count by before a sign-in, so these count by the two
 * things a caller cannot avoid presenting: the address it comes from and the
 * number it claims. Both matter. By address alone, one attacker rotating
 * numbers is slowed but a botnet trying one number is not; by number alone,
 * one address can walk a list. The integration suite runs with limits off, so
 * they are built here with the switch in the production position.
 */
function phoneSignIn(): PhoneSignInService {
  return {
    widget: () => ({
      enabled: true,
      driver: 'fake' as const,
      widgetId: null,
      tokenAuth: null,
      devCode: '123456',
      reason: null,
    }),
    signInDealer: () =>
      Promise.resolve({
        token: 'token',
        expiresAt: new Date(Date.now() + 60_000),
        next: 'DASHBOARD' as const,
        returnTo: '/dealer',
      }),
  };
}

const servers: Server[] = [];

async function app() {
  vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
  vi.resetModules();

  const { createRateLimiter } = await import('../../../../src/middleware/rate-limit.js');
  const { createPublicAuthRouter } = await import('../../../../src/modules/auth/auth.routes.js');
  const { errorHandler } = await import('../../../../src/middleware/error-handler.js');
  vi.unstubAllEnvs();

  const application = express();
  application.set('trust proxy', true);
  application.use(express.json());
  application.use(
    '/v1/auth',
    createPublicAuthRouter(
      {} as AuthService,
      phoneSignIn(),
      {} as CustomerAuthService,
      createRateLimiter(createMemoryCache()),
    ),
  );
  application.use(errorHandler);

  const server = application.listen(0);
  servers.push(server);
  return server;
}

function body(phone: string) {
  return { phone, accessToken: `dev-otp:91${phone}:123456` };
}

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

describe('the keys', () => {
  function req(value: unknown, ip?: string): Request {
    return { body: value, ip } as unknown as Request;
  }

  it('counts one number however it is written', () => {
    expect(byClaimedPhone(req({ phone: '98400 12345' }))).toBe('+919840012345');
    expect(byClaimedPhone(req({ phone: '09840012345' }))).toBe('+919840012345');
  });

  /** A body that is not a phone still lands in a bucket, and never throws. */
  it.each([undefined, null, 'text', { phone: 42 }, { phone: 'nope' }])(
    'files %j under one shared bucket',
    (value) => {
      expect(byClaimedPhone(req(value))).toBe('not-a-number');
    },
  );

  it('counts by address', () => {
    expect(byIp(req({}, '203.0.113.9'))).toBe('203.0.113.9');
    expect(byIp(req({}))).toBe('unknown');
  });
});

describe('sign-in is rate-limited', () => {
  it('allows ten tries at one number and refuses the eleventh, from any address', async () => {
    const server = await app();

    for (let call = 0; call < 10; call += 1) {
      await request(server)
        .post('/v1/auth/sign-in/phone/dealer')
        .set('X-Forwarded-For', `198.51.100.${String(call)}`)
        .send(body('9840012345'))
        .expect(200);
    }

    const refused = await request(server)
      .post('/v1/auth/sign-in/phone/dealer')
      .set('X-Forwarded-For', '198.51.100.99')
      .send(body('9840012345'))
      .expect(429);
    expect(refused.body.code).toBe('PHONE_OTP_RATE_LIMITED');
  });

  it('allows twenty tries from one address and refuses the twenty-first, whatever the number', async () => {
    const server = await app();

    for (let call = 0; call < 20; call += 1) {
      await request(server)
        .post('/v1/auth/sign-in/phone/dealer')
        .set('X-Forwarded-For', '203.0.113.7')
        .send(body(`98400${String(10000 + call)}`))
        .expect(200);
    }

    await request(server)
      .post('/v1/auth/sign-in/phone/dealer')
      .set('X-Forwarded-For', '203.0.113.7')
      .send(body('9840099999'))
      .expect(429);
  });

  it('sets the session cookie on success, and never caches the answer', async () => {
    const server = await app();
    const res = await request(server)
      .post('/v1/auth/sign-in/phone/dealer')
      .send(body('9840012345'))
      .expect(200);

    expect(res.headers['set-cookie']?.[0]).toMatch(/^dd_session=token;.*HttpOnly/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ next: 'DASHBOARD', returnTo: '/dealer' });
  });
});

describe('the widget before sign-in is rate-limited', () => {
  it('allows thirty an hour per address and refuses the thirty-first', async () => {
    const server = await app();

    for (let call = 0; call < 30; call += 1) {
      await request(server).get('/v1/auth/sign-in/phone/widget').expect(200);
    }

    const refused = await request(server).get('/v1/auth/sign-in/phone/widget').expect(429);
    expect(refused.body.code).toBe('PHONE_OTP_RATE_LIMITED');
  });
});
