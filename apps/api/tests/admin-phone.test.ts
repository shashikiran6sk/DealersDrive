import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../src/modules/auth/session.service.js';
import type request from 'supertest';
import { env } from '../src/config/env.js';
import { createMemoryCache } from '../src/platform/cache/memory.adapter.js';
import type { PhoneOtpPort, PhoneOtpVerdict } from '../src/platform/phone-otp/phone-otp.port.js';
import {
  createAuthHarness,
  createFakeGoogle,
  createRecordingMailer,
  type AuthHarness,
} from './auth-harness.js';

const cache = createMemoryCache();
const proofs = new Map<string, PhoneOtpVerdict>();
let unavailable = false;
let providerCalls = 0;
const otp: PhoneOtpPort = {
  driver: 'fake',
  identify(token) {
    providerCalls += 1;
    return Promise.resolve(
      unavailable
        ? { status: 'UNAVAILABLE' }
        : (proofs.get(token) ?? { status: 'REJECTED', reason: 'controlled refusal' }),
    );
  },
};
let h: AuthHarness;
let serial = 0;
const origin = env.webOrigins[0] ?? 'http://localhost:3000';
const LOGIN = '/v1/auth/admin/phone';
const ENROLL = '/v1/admin/profile/security/phone';
type Challenge = {
  challengeId: string;
  browserToken: string;
  expiresAt: string;
  resendAfterSeconds: number;
};
type Fixture = { agent: request.Agent; userId: string; phone: string; sessionId: string };
beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle(), createRecordingMailer(), {
    phoneOtp: otp,
    cache,
  });
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await cache.reset();
  proofs.clear();
  unavailable = false;
  providerCalls = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function admin(): Promise<Fixture> {
  serial += 1;
  const email = `admin-phone-${serial}@example.test`;
  const user = await h.prisma.user.create({
    data: {
      email,
      emailVerifiedAt: new Date(),
      fullName: 'Synthetic Administrator',
      adminMember: { create: { role: 'SUPER_ADMIN', status: 'ACTIVE', source: 'INVITED' } },
    },
  });
  h.google.claims = {
    subject: `admin-phone-${serial}`,
    email,
    emailVerified: true,
    name: 'Synthetic Administrator',
  };
  const agent = h.agent();
  expect((await h.signInAdmin(agent)).location).toContain('/admin');
  const session = await h.prisma.session.findFirstOrThrow({
    where: { userId: user.id, scope: 'ADMIN', revokedAt: null },
  });
  return { agent, userId: user.id, sessionId: session.id, phone: `+91${9000001000 + serial}` };
}
async function challenge(agent: request.Agent, base: string, phone: string): Promise<Challenge> {
  return (await agent.post(`${base}/challenge`).set('Origin', origin).send({ phone }).expect(200))
    .body as Challenge;
}
function token(phone: string, overrides: Partial<{ issuedAt: Date; expiresAt: Date }> = {}) {
  const value = randomUUID();
  proofs.set(value, {
    status: 'VERIFIED',
    identifier: phone.replace(/^\+/, ''),
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 300_000),
    ...overrides,
  });
  return value;
}
function verify(agent: request.Agent, base: string, c: Challenge, accessToken: string) {
  return agent
    .post(`${base}/verify`)
    .set('Origin', origin)
    .send({ challengeId: c.challengeId, browserToken: c.browserToken, accessToken });
}
async function enroll(f: Fixture) {
  const c = await challenge(f.agent, ENROLL, f.phone);
  await verify(f.agent, ENROLL, c, token(f.phone)).expect(200);
  await h.prisma.adminOtpChallenge.updateMany({
    where: { phone: f.phone },
    data: { createdAt: new Date(Date.now() - 61_000) },
  });
}
async function loginChallenge(f: Fixture) {
  return challenge(h.agent(), LOGIN, f.phone);
}

describe('admin mobile credentials and challenge boundaries', () => {
  it('serializes member disabling with OTP issuance and leaves no usable admin session', async () => {
    const controller = await admin();
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    const loginAgent = h.agent();
    const member = await h.prisma.adminMember.findUniqueOrThrow({ where: { userId: f.userId } });
    const [signedIn, disabled] = await Promise.all([
      verify(loginAgent, LOGIN, c, token(f.phone)),
      controller.agent
        .post(`/v1/admin/members/${member.id}/disable`)
        .send({ reason: 'Synthetic concurrent security revocation' }),
    ]);
    expect(disabled.status).toBe(200);
    expect([200, 403]).toContain(signedIn.status);
    await loginAgent.get('/v1/admin/metrics/overview').expect(401);
    expect(
      await h.prisma.session.count({
        where: { userId: f.userId, scope: 'ADMIN', revokedAt: null },
      }),
    ).toBe(0);
  });
  it('does not reactivate a suspended admin seat during Google step-up', async () => {
    const f = await admin();
    await h.prisma.userRole.updateMany({
      where: { userId: f.userId, role: 'ADMIN' },
      data: { status: 'SUSPENDED' },
    });
    const before = await h.prisma.session.count({ where: { userId: f.userId, scope: 'ADMIN' } });
    expect((await h.signInAdmin(f.agent)).location).toContain('error=account_suspended');
    expect(
      (
        await h.prisma.userRole.findUniqueOrThrow({
          where: { userId_role: { userId: f.userId, role: 'ADMIN' } },
        })
      ).status,
    ).toBe('SUSPENDED');
    expect(await h.prisma.session.count({ where: { userId: f.userId, scope: 'ADMIN' } })).toBe(
      before,
    );
    await f.agent.get('/v1/admin/metrics/overview').expect(401);
  });
  it('fails closed when the shared IP limiter is unavailable', async () => {
    const f = await admin();
    vi.spyOn(cache, 'increment').mockRejectedValue(new Error('controlled cache outage'));
    await h
      .agent()
      .post(`${LOGIN}/challenge`)
      .set('Origin', origin)
      .send({ phone: f.phone })
      .expect(503);
    expect(await h.prisma.adminOtpChallenge.count({ where: { phone: f.phone } })).toBe(0);
  });
  it('fails closed when proof replay protection is unavailable', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    vi.spyOn(cache, 'increment').mockRejectedValue(new Error('controlled cache outage'));
    await verify(f.agent, ENROLL, c, token(f.phone)).expect(503);
    expect(await h.prisma.adminPhoneCredential.count({ where: { userId: f.userId } })).toBe(0);
  });
  it('enforces the IP request quota without relying on the general optional limiter', async () => {
    const f = await admin();
    for (let i = 0; i < 40; i += 1)
      await cache.increment(`admin-otp:ip:${hashToken('::ffff:127.0.0.1')}`, 600);
    await h
      .agent()
      .post(`${LOGIN}/challenge`)
      .set('Origin', origin)
      .send({ phone: f.phone })
      .expect(429);
  });
  it('rejects out-of-range attempts and noncanonical credential numbers at the database boundary', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    await expect(
      h.prisma.adminOtpChallenge.update({ where: { id: c.challengeId }, data: { attempts: 6 } }),
    ).rejects.toThrow(/admin_otp_challenges_attempts_check/);
    await expect(
      h.prisma.adminPhoneCredential.create({
        data: { userId: f.userId, phone: 'invalid', phoneVerifiedAt: new Date() },
      }),
    ).rejects.toThrow(/admin_phone_credentials_phone_check/);
    const credential = await h.prisma.adminPhoneCredential.create({
      data: { userId: f.userId, phone: f.phone, phoneVerifiedAt: new Date() },
    });
    await expect(
      h.prisma.adminOtpChallenge.update({
        where: { id: c.challengeId },
        data: { credentialId: credential.id, credentialVersion: null },
      }),
    ).rejects.toThrow(/check constraint/);
  });
  it('links a fresh Google admin to a separate verified credential and audits without raw phone data', async () => {
    const f = await admin();
    await enroll(f);
    const row = await h.prisma.adminPhoneCredential.findUniqueOrThrow({
      where: { userId: f.userId },
    });
    expect(row.phoneVerifiedAt).toBeInstanceOf(Date);
    expect((await h.prisma.user.findUniqueOrThrow({ where: { id: f.userId } })).phone).toBeNull();
    const security = await f.agent.get('/v1/admin/profile/security').expect(200);
    expect(security.body).toMatchObject({ linked: true, requiresGoogleReauthentication: false });
    expect(JSON.stringify(security.body)).not.toContain(f.phone);
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { actorId: f.userId, action: 'admin.phone.enrolled' },
    });
    expect(JSON.stringify(audit)).not.toContain(f.phone);
  });
  it('issues an isolated rotated admin OTP session and preserves its existing identity', async () => {
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    const response = await verify(f.agent, LOGIN, c, token(f.phone)).expect(200);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('dd_admin_session=')]),
    );
    expect(response.headers['set-cookie']).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^dd_session=/)]),
    );
    expect(
      (await h.prisma.session.findUniqueOrThrow({ where: { id: f.sessionId } })).revokedAt,
    ).not.toBeNull();
    expect(
      await h.prisma.session.count({
        where: {
          userId: f.userId,
          scope: 'ADMIN',
          authenticationMethod: 'PHONE_OTP',
          revokedAt: null,
        },
      }),
    ).toBe(1);
    await f.agent.get('/v1/admin/metrics/overview').expect(200);
  });
  it.each(['stale', 'legacy', 'phone'] as const)(
    'refuses enrollment from %s assurance',
    async (kind) => {
      const f = await admin();
      await h.prisma.session.update({
        where: { id: f.sessionId },
        data:
          kind === 'stale'
            ? { createdAt: new Date(Date.now() - 601_000) }
            : { authenticationMethod: kind === 'legacy' ? null : 'PHONE_OTP' },
      });
      const response = await f.agent
        .post(`${ENROLL}/challenge`)
        .set('Origin', origin)
        .send({ phone: f.phone })
        .expect(403);
      expect(response.body.code).toBe('ADMIN_GOOGLE_REAUTH_REQUIRED');
    },
  );
  it('rejects forged admin cookies and unauthenticated enrollment', async () => {
    await h
      .agent()
      .post(`${ENROLL}/challenge`)
      .set('Origin', origin)
      .send({ phone: '+919000001234' })
      .expect(401);
    await h
      .agent()
      .get('/v1/admin/profile/security')
      .set('Cookie', 'dd_admin_session=forged')
      .expect(401);
  });
  it('cannot move an enrollment to another browser or Google session', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    const other = h.agent();
    await h.signInAdmin(other);
    await verify(other, ENROLL, c, token(f.phone)).expect(403);
    expect(await h.prisma.adminPhoneCredential.count({ where: { userId: f.userId } })).toBe(0);
  });
  it('rejects wrong browser binding before contacting the provider', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    await verify(f.agent, ENROLL, { ...c, browserToken: 'A'.repeat(43) }, token(f.phone)).expect(
      403,
    );
    expect(providerCalls).toBe(0);
  });
  it('rejects a challenge used for the wrong purpose', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    await verify(f.agent, LOGIN, c, token(f.phone)).expect(403);
    expect(providerCalls).toBe(0);
  });
  it.each(['expired', 'old', 'future', 'missing'] as const)(
    'rejects %s provider freshness',
    async (kind) => {
      const f = await admin();
      const c = await challenge(f.agent, ENROLL, f.phone);
      const t = token(f.phone);
      proofs.set(t, {
        status: 'VERIFIED',
        identifier: f.phone.slice(1),
        ...(kind === 'missing'
          ? {}
          : {
              issuedAt: new Date(
                Date.now() + (kind === 'future' ? 60_000 : kind === 'old' ? -60_000 : 0),
              ),
              expiresAt: new Date(Date.now() + (kind === 'expired' ? -1 : 60_000)),
            }),
      });
      await verify(f.agent, ENROLL, c, t).expect(403);
    },
  );
  it('rejects a locally expired challenge before provider verification', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    await h.prisma.adminOtpChallenge.update({
      where: { id: c.challengeId },
      data: { createdAt: new Date(Date.now() - 600_000), expiresAt: new Date(Date.now() - 1) },
    });
    await verify(f.agent, ENROLL, c, token(f.phone)).expect(403);
    expect(providerCalls).toBe(0);
  });
  it('persists five failed attempts and refuses the sixth independently of the UI', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    for (let i = 0; i < 5; i += 1) await verify(f.agent, ENROLL, c, randomUUID()).expect(403);
    await verify(f.agent, ENROLL, c, token(f.phone)).expect(403);
    expect(providerCalls).toBe(5);
    expect(
      (await h.prisma.adminOtpChallenge.findUniqueOrThrow({ where: { id: c.challengeId } }))
        .attempts,
    ).toBe(5);
  });
  it('fails securely on provider outage and permits a later valid retry', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    unavailable = true;
    await verify(f.agent, ENROLL, c, token(f.phone)).expect(503);
    unavailable = false;
    await verify(f.agent, ENROLL, c, token(f.phone)).expect(200);
  });
  it('rejects a token proving a different number', async () => {
    const f = await admin();
    const c = await challenge(f.agent, ENROLL, f.phone);
    await verify(f.agent, ENROLL, c, token('+919000009999')).expect(403);
  });
  it('redeems the same challenge only once under concurrent callbacks', async () => {
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    const t = token(f.phone);
    const responses = await Promise.all([
      verify(h.agent(), LOGIN, c, t),
      verify(h.agent(), LOGIN, c, t),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 403]);
    expect(await h.prisma.adminOtpRedemption.count({ where: { challengeId: c.challengeId } })).toBe(
      1,
    );
  });
  it('rejects replay after the cache is cleared using durable database redemption', async () => {
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    const t = token(f.phone);
    await verify(h.agent(), LOGIN, c, t).expect(200);
    await cache.reset();
    await h.prisma.adminOtpChallenge.updateMany({
      where: { phone: f.phone },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    const next = await loginChallenge(f);
    await verify(h.agent(), LOGIN, next, t).expect(403);
  });
  it('enforces a persistent resend cooldown across browsers', async () => {
    const f = await admin();
    await challenge(h.agent(), LOGIN, f.phone);
    await h
      .agent()
      .post(`${LOGIN}/challenge`)
      .set('Origin', origin)
      .send({ phone: f.phone })
      .expect(429);
  });
  it('allows only one concurrent request for the same number', async () => {
    const f = await admin();
    const responses = await Promise.all([
      h.agent().post(`${LOGIN}/challenge`).set('Origin', origin).send({ phone: f.phone }),
      h.agent().post(`${LOGIN}/challenge`).set('Origin', origin).send({ phone: f.phone }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 429]);
  });
  it('limits phone requests in a ten-minute window', async () => {
    const f = await admin();
    for (let i = 0; i < 5; i += 1) {
      await challenge(h.agent(), LOGIN, f.phone);
      await h.prisma.adminOtpChallenge.updateMany({
        where: { phone: f.phone },
        data: { createdAt: new Date(Date.now() - 61_000) },
      });
    }
    await h
      .agent()
      .post(`${LOGIN}/challenge`)
      .set('Origin', origin)
      .send({ phone: f.phone })
      .expect(429);
  });
  it.each(['missing', 'foreign', 'cross-site', 'form'] as const)(
    'rejects %s CSRF context',
    async (kind) => {
      const req = h.agent().post(`${LOGIN}/challenge`);
      if (kind !== 'missing')
        req.set('Origin', kind === 'foreign' ? 'https://attacker.example.test' : origin);
      if (kind === 'cross-site') req.set('Sec-Fetch-Site', 'cross-site');
      if (kind === 'form') req.type('form');
      await req.send({ phone: '+919000009999' }).expect(403);
    },
  );
  it.each(['customer', 'dealer', 'unregistered'] as const)(
    'never grants admin access to a number linked only to %s',
    async (kind) => {
      serial += 1;
      const phone = `+91${9000001000 + serial}`;
      if (kind !== 'unregistered')
        await h.prisma.user.create({
          data: {
            phone,
            phoneVerifiedAt: new Date(),
            fullName: 'Synthetic Person',
            roles: { create: { role: kind === 'customer' ? 'CUSTOMER' : 'DEALER' } },
          },
        });
      const agent = h.agent();
      const c = await challenge(agent, LOGIN, phone);
      expect(c).toEqual({
        challengeId: expect.any(String),
        browserToken: expect.any(String),
        expiresAt: expect.any(String),
        resendAfterSeconds: 60,
      });
      const response = await verify(agent, LOGIN, c, token(phone)).expect(403);
      expect(response.body.detail).not.toContain(phone);
      await agent.get('/v1/admin/metrics/overview').expect(401);
    },
  );
  it('preserves separate customer and admin identities sharing one verified number', async () => {
    const f = await admin();
    const customer = await h.prisma.user.create({
      data: { phone: f.phone, phoneVerifiedAt: new Date(), fullName: 'Synthetic Customer' },
    });
    await enroll(f);
    const c = await loginChallenge(f);
    await verify(f.agent, LOGIN, c, token(f.phone)).expect(200);
    expect(
      (await h.prisma.adminPhoneCredential.findUniqueOrThrow({ where: { phone: f.phone } })).userId,
    ).toBe(f.userId);
    expect((await h.prisma.user.findUniqueOrThrow({ where: { phone: f.phone } })).id).toBe(
      customer.id,
    );
  });
  it.each([
    'suspended_user',
    'disabled_member',
    'invited_member',
    'removed_member',
    'suspended_seat',
  ] as const)('rejects %s after challenge creation', async (kind) => {
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    if (kind === 'suspended_user')
      await h.prisma.user.update({ where: { id: f.userId }, data: { status: 'SUSPENDED' } });
    else if (kind === 'removed_member')
      await h.prisma.adminMember.delete({ where: { userId: f.userId } });
    else if (kind === 'suspended_seat')
      await h.prisma.userRole.updateMany({
        where: { userId: f.userId, role: 'ADMIN' },
        data: { status: 'SUSPENDED' },
      });
    else
      await h.prisma.adminMember.update({
        where: { userId: f.userId },
        data: { status: kind === 'disabled_member' ? 'DISABLED' : 'INVITED' },
      });
    await verify(h.agent(), LOGIN, c, token(f.phone)).expect(403);
  });
  it('prevents direct phone replacement and enforces database uniqueness', async () => {
    const f = await admin();
    await enroll(f);
    await f.agent
      .post(`${ENROLL}/challenge`)
      .set('Origin', origin)
      .send({ phone: '+919000009999' })
      .expect(409);
    const other = await admin();
    await expect(
      h.prisma.adminPhoneCredential.create({
        data: { userId: other.userId, phone: f.phone, phoneVerifiedAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('revokes pending proofs and every admin session, then allows Google recovery and new-number enrollment', async () => {
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    const other = h.agent();
    await h.signInAdmin(other);
    await f.agent
      .post(`${ENROLL}/revoke`)
      .set('Origin', origin)
      .send({ confirm: true })
      .expect(204);
    await other.get('/v1/admin/metrics/overview').expect(401);
    await verify(h.agent(), LOGIN, c, token(f.phone)).expect(403);
    expect(
      await h.prisma.session.count({
        where: { userId: f.userId, scope: 'ADMIN', revokedAt: null },
      }),
    ).toBe(0);
    await h.signInAdmin(f.agent);
    const newPhone = '+919000008888';
    const fresh = await challenge(f.agent, ENROLL, newPhone);
    await verify(f.agent, ENROLL, fresh, token(newPhone)).expect(200);
    expect(
      (await h.prisma.adminPhoneCredential.findUniqueOrThrow({ where: { userId: f.userId } }))
        .version,
    ).toBe(3);
  });
  it('refuses mobile-only credential revocation and forged confirmation', async () => {
    const f = await admin();
    await enroll(f);
    const c = await loginChallenge(f);
    await verify(f.agent, LOGIN, c, token(f.phone)).expect(200);
    await f.agent
      .post(`${ENROLL}/revoke`)
      .set('Origin', origin)
      .send({ confirm: true })
      .expect(403);
    await f.agent
      .post(`${ENROLL}/revoke`)
      .set('Origin', origin)
      .send({ confirm: false })
      .expect(400);
  });
});
