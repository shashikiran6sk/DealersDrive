import type { DealerStatus } from '@prisma/client';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import type { OAuthClaims } from '../src/modules/auth/oauth.port.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R60 — a dealer signs in with their phone, and lands where Google would have
 * sent them.
 *
 * The property that matters most is the one that would drift silently: the
 * method of sign-in must never change the destination. So every status is
 * signed into twice — once through the Google callback, once with the phone —
 * and the two answers are compared, rather than each being compared with a
 * table that could itself be wrong.
 */
let h: AuthHarness;
let counter = 0;
let tokens = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

function freshGoogle(): OAuthClaims {
  counter += 1;
  h.google.claims = {
    subject: `phone-sign-in-sub-${String(counter)}`,
    email: `phone.sign.in${String(counter)}@example.com`,
    emailVerified: true,
    name: 'Phone Sign-in Dealer',
  };
  return h.google.claims;
}

/** A number nothing else in the suite or the seed holds. */
function freeNumber(): string {
  counter += 1;
  return `98433${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string, code: string = env.PHONE_OTP_DEV_CODE): string {
  tokens += 1;
  return `dev-otp:91${phone.slice(-10)}:${code}:sign-in-${String(tokens)}`;
}

interface Dealer {
  phone: string;
  claims: OAuthClaims;
  userId: string;
}

/**
 * A dealer the way the product makes one: Google, a proved number, then (for
 * any status but "none") the onboarding create — with the status set by hand
 * afterwards, since reaching ACTIVE through the review screen is other suites'
 * business.
 */
async function dealer(status: DealerStatus | null, statusReason?: string): Promise<Dealer> {
  const claims = freshGoogle();
  const phone = freeNumber();
  const agent = h.agent();
  await h.signIn(agent);
  await h.proveNumber(agent, phone);

  if (status !== null) {
    await agent
      .post('/v1/auth/onboarding')
      .send({
        fullName: 'R. Manikandan',
        phone,
        legalName: `Phone Sign-in Motors ${String(counter)}`,
        addressLine: '18, Gandhi Road',
        city: 'Katpadi',
        district: 'Vellore',
        state: 'Tamil Nadu',
        pincode: '632007',
        mapsUrl: 'https://maps.app.goo.gl/phone-sign-in',
        tagline: 'Family-run dealership in Katpadi, trading since 1998.',
        specialities: ['Hatchbacks'],
      })
      .expect(201);
  }

  const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: `+91${phone}` } });

  if (status !== null && status !== 'DRAFT') {
    await h.prisma.dealer.updateMany({
      where: { members: { some: { userId: user.id } } },
      data: { status },
    });
  }
  if (statusReason) {
    await h.prisma.dealer.updateMany({
      where: { members: { some: { userId: user.id } } },
      data: { statusReason },
    });
  }

  return { phone, claims, userId: user.id };
}

function phoneSignIn(agent: request.Agent, phone: string, returnTo?: string) {
  return agent
    .post('/v1/auth/sign-in/phone/dealer')
    .send({ phone, accessToken: devToken(phone), ...(returnTo ? { returnTo } : {}) });
}

async function googleDestination(claims: OAuthClaims): Promise<string> {
  h.google.claims = claims;
  const { location } = await h.signIn(h.agent());
  return location.replace(env.WEB_BASE_URL, '');
}

describe('the destination does not depend on how a dealer signed in', () => {
  it.each([
    ['no dealership yet', null, undefined, 'ONBOARDING', '/dealer/onboarding'],
    ['a draft', 'DRAFT', undefined, 'ONBOARDING', '/dealer/onboarding'],
    [
      'changes requested',
      'DRAFT',
      'Upload a clearer GST certificate.',
      'ONBOARDING',
      '/dealer/onboarding',
    ],
    ['under review', 'PENDING_APPROVAL', undefined, 'PENDING_APPROVAL', '/dealer'],
    ['approved', 'ACTIVE', undefined, 'DASHBOARD', '/dealer'],
    ['rejected', 'REJECTED', undefined, 'DASHBOARD', '/dealer'],
  ] as const)('%s', async (_label, status, reason, next, returnTo) => {
    const account = await dealer(status, reason);
    const agent = h.agent();

    const signedIn = await phoneSignIn(agent, account.phone).expect(200);

    expect(signedIn.body).toEqual({ next, returnTo });
    expect(await googleDestination(account.claims)).toBe(returnTo);

    const me = await agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({ next, user: { id: account.userId, phoneVerified: true } });
  });

  it('refuses a suspended dealership, as Google does', async () => {
    const account = await dealer('SUSPENDED');

    const refused = await phoneSignIn(h.agent(), account.phone).expect(403);
    expect(refused.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(refused.headers['set-cookie']).toBeUndefined();

    expect(await googleDestination(account.claims)).toBe('/dealer/login?error=account_suspended');
  });
});

describe('the session it issues', () => {
  it('is an ordinary dealer session: the console opens, and logout closes it', async () => {
    const account = await dealer('ACTIVE');
    const agent = h.agent();
    await phoneSignIn(agent, account.phone).expect(200);

    const session = await h.prisma.session.findFirstOrThrow({
      where: { userId: account.userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session.scope).toBe('DEALER');

    await agent.get('/v1/dealer/dashboard').expect(200);
    await agent.post('/v1/auth/logout').expect(204);
    await agent.get('/v1/auth/me').expect(401);
  });

  it('records the sign-in in the audit log', async () => {
    const account = await dealer('ACTIVE');
    await phoneSignIn(h.agent(), account.phone).expect(200);

    const row = await h.prisma.auditLog.findFirst({
      where: { entityId: account.userId, action: 'auth.login.phone' },
    });
    expect(row?.after).toEqual({ next: 'DASHBOARD' });
  });

  it('is found by the number however it is typed', async () => {
    const account = await dealer('ACTIVE');
    const typed = `0${account.phone.slice(0, 5)} ${account.phone.slice(5)}`;

    await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: typed, accessToken: devToken(account.phone) })
      .expect(200);
  });
});

describe('where it sends an approved dealer', () => {
  it('honours a path', async () => {
    const account = await dealer('ACTIVE');
    const res = await phoneSignIn(h.agent(), account.phone, '/dealer/inventory').expect(200);
    expect(res.body.returnTo).toBe('/dealer/inventory');
  });

  it.each(['https://evil.example/steal', '//evil.example', '/\\evil.example'])(
    'refuses to redirect to %j',
    async (target) => {
      const account = await dealer('ACTIVE');
      const res = await phoneSignIn(h.agent(), account.phone, target).expect(200);
      expect(res.body.returnTo).toBe('/dealer');
    },
  );

  it('sends a draft to onboarding whatever it asked for', async () => {
    const account = await dealer('DRAFT');
    const res = await phoneSignIn(h.agent(), account.phone, '/dealer/inventory').expect(200);
    expect(res.body.returnTo).toBe('/dealer/onboarding');
  });
});

describe('what it refuses', () => {
  it('a wrong code, before anything about the number is revealed', async () => {
    const account = await dealer('ACTIVE');

    const res = await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: account.phone, accessToken: devToken(account.phone, '000000') })
      .expect(422);

    expect(res.body.code).toBe('PHONE_VERIFICATION_FAILED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('a token presented twice', async () => {
    const account = await dealer('ACTIVE');
    const accessToken = devToken(account.phone);

    await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: account.phone, accessToken })
      .expect(200);
    const replay = await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: account.phone, accessToken })
      .expect(422);
    expect(replay.body.code).toBe('PHONE_VERIFICATION_FAILED');
  });

  it('a token for a different number than the one claimed', async () => {
    const account = await dealer('ACTIVE');
    await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: account.phone, accessToken: devToken(freeNumber()) })
      .expect(422);
  });

  /** After the proof, saying "no account" tells a caller nothing they do not hold. */
  it('a proved number no dealer holds — and creates nothing', async () => {
    const phone = freeNumber();
    const before = await h.prisma.user.count();

    const res = await phoneSignIn(h.agent(), phone).expect(404);

    expect(res.body.code).toBe('DEALER_NOT_FOUND');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await h.prisma.user.count()).toBe(before);
  });

  /**
   * A legacy dealer whose number was typed, never proved, does not become
   * signed in by proving it now: that number is not an identity yet.
   */
  it('a number an account holds but never verified', async () => {
    const phone = freeNumber();
    const user = await h.prisma.user.create({ data: { phone: `+91${phone}` } });
    await h.prisma.userRole.create({ data: { userId: user.id, role: 'DEALER' } });

    const res = await phoneSignIn(h.agent(), phone).expect(404);
    expect(res.body.code).toBe('DEALER_NOT_FOUND');
  });

  it('a dealer seat that has been closed', async () => {
    const account = await dealer('ACTIVE');
    await h.prisma.userRole.updateMany({
      where: { userId: account.userId, role: 'DEALER' },
      data: { status: 'SUSPENDED' },
    });

    const res = await phoneSignIn(h.agent(), account.phone).expect(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('a field it does not know, by name', async () => {
    const res = await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: '9840012345', accessToken: 'x', dealerId: 'someone-else' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('dealerId');
  });
});

describe('the widget, before sign-in', () => {
  it('is served without a session, and never cached', async () => {
    const res = await h.agent().get('/v1/auth/sign-in/phone/widget').expect(200);

    expect(res.body).toMatchObject({ enabled: true, driver: 'fake' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(res.body)).not.toContain('authkey');
  });
});
