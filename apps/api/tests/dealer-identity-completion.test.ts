import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import type { OAuthClaims } from '../src/modules/auth/oauth.port.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R61 — a new dealer starts with either identity, and step 1 asks for the other.
 *
 * Two entry paths converge on one account:
 *
 *   phone first  → proved number → provisional dealer → link Google → continue
 *   Google first → provisional dealer → prove number             → continue
 *
 * and neither can create a dealership until both identities are in place. The
 * linking round trip is the security-sensitive part, so it is driven through
 * the real start → callback path with the session cookie in play, including
 * the cases where it must refuse.
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
    subject: `completion-sub-${String(counter)}`,
    email: `completion${String(counter)}@example.com`,
    emailVerified: true,
    name: 'Completion Dealer',
  };
  return h.google.claims;
}

function freeNumber(): string {
  counter += 1;
  return `98444${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string): string {
  tokens += 1;
  return `dev-otp:91${phone.slice(-10)}:${env.PHONE_OTP_DEV_CODE}:completion-${String(tokens)}`;
}

function onboarding(phone: string) {
  return {
    fullName: 'S. Karthik',
    phone,
    legalName: `Completion Cars ${String(counter)}`,
    addressLine: '4, Main Bazaar',
    city: 'Ranipet',
    district: 'Ranipet',
    state: 'Tamil Nadu',
    pincode: '632401',
    mapsUrl: 'https://maps.app.goo.gl/completion',
    tagline: 'Pre-owned cars in Ranipet, inspected before sale.',
    specialities: ['Sedans'],
  };
}

async function phoneFirst(agent: request.Agent, phone = freeNumber()) {
  const res = await agent
    .post('/v1/auth/sign-in/phone/dealer')
    .send({ phone, accessToken: devToken(phone) })
    .expect(200);
  const session = [res.headers['set-cookie']]
    .flat()
    .find((c) => c?.startsWith('dd_session='))
    ?.split(';')[0];
  return { phone, session, body: res.body as { next: string; returnTo: string } };
}

/** start → Google → callback, for the link audience, on one agent. */
async function link(agent: request.Agent, callbackAgent: request.Agent = agent) {
  const started = await agent.get('/v1/auth/google/link/start').expect(302);
  const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
  const cookie = [started.headers['set-cookie']].flat().find((c) => c?.startsWith('dd_oauth='));

  const callback =
    callbackAgent === agent
      ? await agent.get(`/v1/auth/google/callback?code=auth-code&state=${state}`)
      : await callbackAgent
          .get(`/v1/auth/google/callback?code=auth-code&state=${state}`)
          .set('Cookie', cookie?.split(';')[0] ?? '');

  return {
    status: callback.status,
    location: String(callback.headers.location ?? '').replace(env.WEB_BASE_URL, ''),
    setsSession: [callback.headers['set-cookie']].flat().some((c) => c?.startsWith('dd_session=')),
  };
}

describe('phone first', () => {
  it('creates a provisional dealer: phone proved, Google missing, sent to step 1', async () => {
    const agent = h.agent();
    const { phone, body } = await phoneFirst(agent);

    expect(body).toEqual({ next: 'ONBOARDING', returnTo: '/dealer/onboarding' });

    const user = await h.prisma.user.findUniqueOrThrow({
      where: { phone: `+91${phone}` },
      include: { roles: true, identities: true },
    });
    expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(user.email).toBeNull();
    expect(user.identities).toHaveLength(0);
    expect(user.roles.map((seat) => seat.role)).toEqual(['DEALER']);

    const me = await agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      next: 'ONBOARDING',
      identity: null,
      user: { phoneVerified: true, email: null },
    });
  });

  it('cannot create a dealership until Google is linked', async () => {
    const agent = h.agent();
    const { phone } = await phoneFirst(agent);

    const refused = await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(422);
    expect(refused.body.code).toBe('ONBOARDING_IDENTITY_INCOMPLETE');
    expect(await h.prisma.dealer.count({ where: { contactPhone: `+91${phone}` } })).toBe(0);
  });

  it('links Google on the same account, keeps the session, then continues', async () => {
    const agent = h.agent();
    const { phone } = await phoneFirst(agent);
    const claims = freshGoogle();

    const linked = await link(agent);
    expect(linked).toEqual({ status: 302, location: '/dealer/onboarding', setsSession: false });

    const me = await agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      identity: { provider: 'GOOGLE', email: claims.email },
      user: { phoneVerified: true, email: claims.email },
    });

    await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(201);
  });

  /** Both doors now open onto the same account. */
  it('converges: Google and the phone both sign in to the one user', async () => {
    const agent = h.agent();
    const { phone } = await phoneFirst(agent);
    const claims = freshGoogle();
    await link(agent);

    const byPhone = await agent.get('/v1/auth/me').expect(200);

    h.google.claims = claims;
    const viaGoogle = h.agent();
    await h.signIn(viaGoogle);
    const byGoogle = await viaGoogle.get('/v1/auth/me').expect(200);

    const again = h.agent();
    await phoneFirst(again, phone);
    const byPhoneAgain = await again.get('/v1/auth/me').expect(200);

    expect(byGoogle.body.user.id).toBe(byPhone.body.user.id);
    expect(byPhoneAgain.body.user.id).toBe(byPhone.body.user.id);
    expect(await h.prisma.user.count({ where: { phone: `+91${phone}` } })).toBe(1);
  });
});

describe('Google first', () => {
  it('creates a provisional dealer: Google linked, phone missing, sent to step 1', async () => {
    freshGoogle();
    const agent = h.agent();
    const { location } = await h.signIn(agent);

    expect(location).toBe(`${env.WEB_BASE_URL}/dealer/onboarding`);
    const me = await agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      next: 'ONBOARDING',
      identity: { provider: 'GOOGLE' },
      user: { phoneVerified: false },
    });
  });

  it('cannot create a dealership until the phone is proved, then can', async () => {
    freshGoogle();
    const agent = h.agent();
    await h.signIn(agent);
    const phone = freeNumber();

    const refused = await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(422);
    expect(refused.body.code).toBe('PHONE_NOT_VERIFIED');

    await h.proveNumber(agent, phone);
    await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(201);
  });
});

describe('collisions are refused, never merged', () => {
  /**
   * Phone on User A, Google on User B. A phone-first A linking B's Google
   * account is sent back to step 1 with a generic error and both accounts are
   * left exactly as they were.
   */
  it('refuses to link a Google account another user already signs in with', async () => {
    const claimsOfB = freshGoogle();
    await h.signIn(h.agent());

    const agentA = h.agent();
    const { phone } = await phoneFirst(agentA);
    h.google.claims = claimsOfB;

    const linked = await link(agentA);
    expect(linked.location).toBe('/dealer/onboarding?error=identity_already_linked');

    const a = await h.prisma.user.findUniqueOrThrow({
      where: { phone: `+91${phone}` },
      include: { identities: true },
    });
    expect(a.identities).toHaveLength(0);
    const holder = await h.prisma.oAuthIdentity.findUniqueOrThrow({
      where: {
        provider_providerSubject: { provider: 'GOOGLE', providerSubject: claimsOfB.subject },
      },
    });
    expect(holder.userId).not.toBe(a.id);
  });

  it('refuses a Google-first account the phone another account proved', async () => {
    const agentA = h.agent();
    const { phone } = await phoneFirst(agentA);

    freshGoogle();
    const agentB = h.agent();
    await h.signIn(agentB);

    const refused = await agentB
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(409);
    expect(refused.body.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('refuses a second Google account on an account that already has one', async () => {
    const agent = h.agent();
    await phoneFirst(agent);
    freshGoogle();
    await link(agent);

    freshGoogle();
    const again = await link(agent);
    expect(again.location).toBe('/dealer/onboarding?error=identity_already_linked');
  });
});

describe('the link round trip', () => {
  it('needs a session to start', async () => {
    await h.agent().get('/v1/auth/google/link/start').expect(401);
  });

  /**
   * The callback attaches Google to whoever started the link, and only if
   * that person's session is still the one presented. A callback carrying the
   * transaction cookie but no session — a link finished in another browser —
   * links nothing.
   */
  it('links nothing when the callback arrives without the session that started it', async () => {
    const agent = h.agent();
    const { phone } = await phoneFirst(agent);
    freshGoogle();

    const linked = await link(agent, h.agent());

    expect(linked.location).toBe('/dealer/onboarding?error=link_session_mismatch');
    const user = await h.prisma.user.findUniqueOrThrow({
      where: { phone: `+91${phone}` },
      include: { identities: true },
    });
    expect(user.identities).toHaveLength(0);
  });

  it('links nothing when a different account’s session comes back', async () => {
    const starter = h.agent();
    const { phone } = await phoneFirst(starter);
    const { session } = await phoneFirst(h.agent());
    expect(session).toMatch(/^dd_session=/);
    freshGoogle();

    const started = await starter.get('/v1/auth/google/link/start').expect(302);
    const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
    const oauth = [started.headers['set-cookie']].flat().find((c) => c?.startsWith('dd_oauth='));

    const callback = await h
      .agent()
      .get(`/v1/auth/google/callback?code=auth-code&state=${state}`)
      .set('Cookie', [oauth?.split(';')[0] ?? '', session].filter(Boolean).join('; '));

    expect(callback.headers.location).toBe(
      `${env.WEB_BASE_URL}/dealer/onboarding?error=link_session_mismatch`,
    );
    const user = await h.prisma.user.findUniqueOrThrow({
      where: { phone: `+91${phone}` },
      include: { identities: true },
    });
    expect(user.identities).toHaveLength(0);
  });
});
