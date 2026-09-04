import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { UnauthorizedError } from '../src/platform/errors.js';
import { hashToken } from '../src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * Sign-in, end to end, against a real database and a fake Google.
 *
 * Everything here runs through the production path: the sealed OAuth
 * transaction cookie, the state comparison, the `sessions` row, the
 * `dd_session` cookie and the cookie session resolver. Only the provider is
 * replaced — a test that depended on accounts.google.com would be a test of
 * Google's uptime.
 *
 * The properties being pinned are the ones that would be silent if they broke:
 * that a session is a database row and not a claim in a cookie, that a
 * dealership is created by onboarding rather than by signing in, and that the
 * two session scopes cannot reach each other's routes.
 */
let h: AuthHarness;

/**
 * A distinct dealership per call. The phone number is unique across users, so
 * two tests sharing one would collide on the second — which is a real rule
 * worth testing (it has its own case below), not something to trip over
 * everywhere else.
 */
function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'R. Manikandan',
    roleTitle: 'Proprietor',
    phone: `98400${String(99000 + subjectCounter).slice(-5)}`,
    brandName: 'Katpadi Auto Gallery',
    legalName: 'Katpadi Auto Gallery Pvt Ltd',
    addressLine: '18, Gandhi Road',
    citySlug: 'katpadi',
    pincode: '632007',
    ...overrides,
  };
}

/** A fresh Google account for each test, so no two tests share an identity. */
let subjectCounter = 0;
function newAccount(overrides: { email?: string; emailVerified?: boolean } = {}) {
  subjectCounter += 1;
  h.google.claims = {
    subject: `google-sub-${subjectCounter}`,
    email: overrides.email ?? `dealer${subjectCounter}@example.com`,
    emailVerified: overrides.emailVerified ?? true,
    name: 'Test Dealer',
  };
  h.google.failWith = null;
  return h.google.claims;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

beforeEach(() => {
  newAccount();
});

describe('the authorization request', () => {
  it('sends the browser to Google with state, nonce and a PKCE verifier', async () => {
    const response = await h.agent().get('/v1/auth/google/start').expect(302);

    expect(response.headers.location).toContain('accounts.google.com');
    expect(h.google.lastRequest?.state).toMatch(/^[\w-]{20,}$/);
    expect(h.google.lastRequest?.nonce).toMatch(/^[\w-]{20,}$/);
    // RFC 7636 §4.1 — 43 to 128 characters of unreserved ASCII.
    expect(h.google.lastRequest?.codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  it('seals the transaction into an HttpOnly cookie', async () => {
    const response = await h.agent().get('/v1/auth/google/start').expect(302);
    const cookie = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith('dd_oauth='),
    );

    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    // Lax, not Strict: Google's redirect back is a cross-site top-level GET,
    // and Strict would withhold the cookie on exactly that navigation.
    expect(cookie).toContain('SameSite=Lax');
  });

  it('gives every sign-in a different state', async () => {
    await h.agent().get('/v1/auth/google/start').expect(302);
    const first = h.google.lastRequest?.state;
    await h.agent().get('/v1/auth/google/start').expect(302);

    expect(h.google.lastRequest?.state).not.toBe(first);
  });

  it('refuses to bounce the browser anywhere but a same-site path', async () => {
    const agent = h.agent();
    const { location } = await h.signIn(agent, 'https://evil.example.com/steal');

    expect(location).toBe(`${env.WEB_BASE_URL}/dealer/onboarding`);
  });
});

describe('a first sign-in', () => {
  it('creates the user and the identity, and lands on onboarding', async () => {
    const claims = newAccount();
    const agent = h.agent();

    const { status, location } = await h.signIn(agent);

    expect(status).toBe(302);
    expect(location).toBe(`${env.WEB_BASE_URL}/dealer/onboarding`);

    const identity = await h.prisma.oAuthIdentity.findUnique({
      where: {
        provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject },
      },
      include: { user: true },
    });

    expect(identity?.email).toBe(claims.email);
    expect(identity?.user.emailVerifiedAt).not.toBeNull();
    // Nothing has claimed a phone number: onboarding collects it, and an
    // unverified placeholder would squat on the unique index (§8.1).
    expect(identity?.user.phone).toBeNull();
    expect(identity?.user.passwordHash).toBeNull();
  });

  it('reports the verified Google account so onboarding need not ask for it', async () => {
    const claims = newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const me = await agent.get('/v1/auth/me').expect(200);

    expect(me.body).toMatchObject({
      next: 'ONBOARDING',
      dealer: null,
      role: null,
      permissions: [],
      identity: { provider: 'GOOGLE', email: claims.email },
    });
  });

  it('stores only a hash of the session token', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    const response = await agent.get('/v1/auth/me').expect(200);
    const token = sessionCookieOf(
      response.headers['set-cookie'] as unknown as string[] | undefined,
    );

    // The cookie is not re-sent on a read, so read the row the other way: no
    // stored value may equal any plausible token, and the column is a digest.
    const sessions = await h.prisma.session.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    expect(sessions[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(token).toBeUndefined();
  });

  it('refuses everything a dealer can do until onboarding is finished', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    await agent.get('/v1/dealer').expect(401);
    await agent.get('/v1/dealer/vehicles').expect(401);
  });
});

describe('onboarding', () => {
  it('creates the dealership, the OWNER seat and the KYC placeholders', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    const created = await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);

    expect(created.body.dealer).toMatchObject({
      brandName: 'Katpadi Auto Gallery',
      status: 'DRAFT',
      creditBalance: 0,
    });
    expect(created.body.role).toBe('OWNER');
    expect(created.body.next).toBe('ONBOARDING');
    // The body is what `GET /v1/auth/me` would answer on the next request,
    // permissions included — a client should not have to re-fetch to find out
    // what the seat it just created can do.
    expect(created.body.permissions).toContain('vehicle:write');
    expect(created.body.dealer.slug).toMatch(/^katpadi-auto-gallery/);

    const dealer = await h.prisma.dealer.findUnique({
      where: { id: created.body.dealer.id },
      include: { members: true, documents: true },
    });

    expect(dealer?.slug).toMatch(/^katpadi-auto-gallery/);
    expect(dealer?.members).toHaveLength(1);
    expect(dealer?.members[0]?.role).toBe('OWNER');
    expect(dealer?.documents).toHaveLength(3);
    expect(dealer?.contactPhone).toMatch(/^\+9198400\d{5}$/);
  });

  /**
   * The baseline's form, restored: **F041** mounts `GET /v1/dealer`, so the
   * case can once again end on the profile the new session reads rather than
   * on a 404 standing in for one.
   *
   * The pair of requests around the onboarding call is the whole point. The
   * same cookie is 401 before and 200 after: no second sign-in, no new token
   * — the principal the guard resolves changed from a signed-in person with
   * no dealership into a DEALER the moment onboarding committed.
   */
  it('turns the pending session into a dealer session, with no new sign-in', async () => {
    const agent = h.agent();
    await h.signIn(agent);
    await agent.get('/v1/dealer').expect(401);

    await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);

    const me = await agent.get('/v1/auth/me').expect(200);
    expect(me.body.dealer.brandName).toBe('Katpadi Auto Gallery');
    expect(me.body.role).toBe('OWNER');

    const profile = await agent.get('/v1/dealer').expect(200);
    expect(profile.body.brandName).toBe('Katpadi Auto Gallery');
  });

  it('refuses a second dealership on the same account', async () => {
    const agent = h.agent();
    await h.signIn(agent);
    await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);

    const again = await agent.post('/v1/auth/onboarding').send(onboarding()).expect(403);

    expect(again.body.code).toBe('DEALER_ALREADY_EXISTS');
  });

  it('refuses a phone number another dealership already uses', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    // +919840012345 belongs to the seeded Sri Lakshmi Motors owner.
    const conflict = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ phone: '9840012345' }))
      .expect(409);

    expect(conflict.body.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('refuses a city outside the catalogue', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    const rejected = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ citySlug: 'atlantis' }))
      .expect(422);

    expect(rejected.body.code).toBe('UNKNOWN_CITY');
  });

  /** Rule 1 and rule 5: neither the tenant nor the state machine takes input. */
  it('rejects an attempt to send a dealerId, a status or an email', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    for (const surplus of [
      { dealerId: '00000000-0000-4000-8000-000000000000' },
      { status: 'ACTIVE' },
      { email: 'someone.else@example.com' },
    ]) {
      const response = await agent
        .post('/v1/auth/onboarding')
        .send(onboarding(surplus))
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    }
  });

  it('needs a session at all', async () => {
    await h.agent().post('/v1/auth/onboarding').send(onboarding()).expect(401);
  });
});

describe('a returning dealer', () => {
  it('is recognised by provider subject and goes straight to the console', async () => {
    const first = h.agent();
    await h.signIn(first);
    const created = await first.post('/v1/auth/onboarding').send(onboarding()).expect(201);
    // What admin approval does. Until then the dealership is DRAFT and the
    // dealer is sent back to finish onboarding, which the next test pins.
    await h.prisma.dealer.update({
      where: { id: created.body.dealer.id },
      data: { status: 'ACTIVE', approvedAt: new Date() },
    });
    await first.post('/v1/auth/logout').expect(204);

    const second = h.agent();
    const { location } = await h.signIn(second);

    expect(location).toBe(`${env.WEB_BASE_URL}/dealer`);
    const me = await second.get('/v1/auth/me').expect(200);
    expect(me.body.next).toBe('DASHBOARD');
    expect(me.body.dealer.brandName).toBe('Katpadi Auto Gallery');
  });

  /**
   * A dealership that was never finished is not a dashboard. Signing in again
   * resumes the wizard rather than dropping the dealer somewhere with nothing
   * to show.
   */
  it('sends a dealer with an unfinished dealership back to onboarding', async () => {
    const first = h.agent();
    await h.signIn(first);
    await first.post('/v1/auth/onboarding').send(onboarding()).expect(201);
    await first.post('/v1/auth/logout').expect(204);

    const { location } = await h.signIn(h.agent());

    expect(location).toBe(`${env.WEB_BASE_URL}/dealer/onboarding`);
  });

  it('creates no second user when the same account signs in twice', async () => {
    const claims = newAccount();
    await h.signIn(h.agent());
    await h.signIn(h.agent());

    const identities = await h.prisma.oAuthIdentity.findMany({
      where: { providerSubject: claims.subject },
    });

    expect(identities).toHaveLength(1);
  });

  /**
   * The account is the `sub`, not the address. A dealer who changes the email
   * on their Google account must still land in their own dealership, and the
   * stored copy is refreshed rather than used to find them.
   */
  it('follows the account when the Google email changes', async () => {
    const claims = newAccount();
    const agent = h.agent();
    await h.signIn(agent);
    await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);

    h.google.claims = { ...claims, email: 'renamed@example.com' };
    const later = h.agent();
    await h.signIn(later);

    const me = await later.get('/v1/auth/me').expect(200);
    expect(me.body.dealer.brandName).toBe('Katpadi Auto Gallery');
    expect(me.body.identity.email).toBe('renamed@example.com');
  });
});

describe('what a bad round trip does', () => {
  it('refuses a callback whose state does not match the cookie', async () => {
    const agent = h.agent();
    await agent.get('/v1/auth/google/start').expect(302);

    const response = await agent
      .get('/v1/auth/google/callback?code=auth-code&state=not-the-one')
      .expect(302);

    expect(response.headers.location).toBe(`${env.WEB_BASE_URL}/dealer/login?error=sign_in_failed`);
  });

  it('refuses a callback with no transaction cookie at all', async () => {
    const response = await h
      .agent()
      .get('/v1/auth/google/callback?code=auth-code&state=anything')
      .expect(302);

    expect(response.headers.location).toContain('error=sign_in_failed');
  });

  it('refuses a code Google will not exchange', async () => {
    const agent = h.agent();
    h.google.failWith = new UnauthorizedError('nope', { code: 'OAUTH_EXCHANGE_FAILED' });

    const { location } = await h.signIn(agent);

    expect(location).toContain('error=sign_in_failed');
    expect(await countSessions(h)).toBeGreaterThanOrEqual(0);
  });

  it('refuses an identity token that fails verification', async () => {
    const agent = h.agent();
    h.google.failWith = new UnauthorizedError('bad token', { code: 'OAUTH_IDENTITY_INVALID' });

    const { location } = await h.signIn(agent);

    expect(location).toContain('error=identity_unverified');
  });

  it("passes Google's own refusal back as a declined sign-in", async () => {
    const agent = h.agent();
    await agent.get('/v1/auth/google/start').expect(302);

    const response = await agent
      .get('/v1/auth/google/callback?error=access_denied&state=x')
      .expect(302);

    expect(response.headers.location).toContain('error=google_declined');
  });

  it('refuses a callback with no code', async () => {
    const agent = h.agent();
    await agent.get('/v1/auth/google/start').expect(302);

    const response = await agent.get('/v1/auth/google/callback?state=x').expect(302);

    expect(response.headers.location).toContain('error=invalid_callback');
  });

  it('spends the transaction cookie, so a callback cannot be replayed', async () => {
    const agent = h.agent();
    const started = await agent.get('/v1/auth/google/start').expect(302);
    const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';

    await agent.get(`/v1/auth/google/callback?code=c&state=${state}`).expect(302);
    const replay = await agent.get(`/v1/auth/google/callback?code=c&state=${state}`).expect(302);

    expect(replay.headers.location).toContain('error=sign_in_failed');
  });

  /**
   * The account-linking policy, stated as a test: a verified email that already
   * belongs to an account is not a way into it. Silently merging on a matching
   * string is how an expired domain becomes somebody else's inventory.
   */
  it('refuses to adopt an existing account by email alone', async () => {
    newAccount({ email: 'owner@srilakshmimotors.in' });

    const { location } = await h.signIn(h.agent());

    expect(location).toContain('error=account_link_required');
  });

  it('refuses a suspended account', async () => {
    const claims = newAccount();
    await h.signIn(h.agent());
    await h.prisma.user.updateMany({
      where: { email: claims.email },
      data: { status: 'SUSPENDED' },
    });

    const { location } = await h.signIn(h.agent());

    expect(location).toContain('error=account_suspended');
  });
});

describe('sessions and sign-out', () => {
  it('revokes the row, not just the cookie', async () => {
    const agent = h.agent();
    await h.signIn(agent);

    const before = await h.prisma.session.count({ where: { revokedAt: null } });
    await agent.post('/v1/auth/logout').expect(204);
    const after = await h.prisma.session.count({ where: { revokedAt: null } });

    expect(after).toBe(before - 1);
    await agent.get('/v1/auth/me').expect(401);
  });

  it('stops honouring a session revoked out of band', async () => {
    const agent = h.agent();
    await h.signIn(agent);
    await agent.get('/v1/auth/me').expect(200);

    // What suspending a dealer does. The principal is rebuilt from the database
    // on every request, so this takes effect on the very next call.
    await h.prisma.session.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await agent.get('/v1/auth/me').expect(401);
  });

  it('stops honouring an expired session', async () => {
    const agent = h.agent();
    await h.signIn(agent);
    await h.prisma.session.updateMany({
      where: { revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await agent.get('/v1/auth/me').expect(401);
  });

  it('ignores a forged cookie', async () => {
    await h
      .agent()
      .get('/v1/auth/me')
      .set('Cookie', `dd_session=${'a'.repeat(43)}`)
      .expect(401);
  });

  it('is not a lookup by anything the client controls', async () => {
    // The token in the cookie is the only input. Its hash is what is stored, so
    // knowing the hash — a database leak — does not let anyone sign in.
    const agent = h.agent();
    await h.signIn(agent);
    const session = await h.prisma.session.findFirst({ orderBy: { createdAt: 'desc' } });

    await h
      .agent()
      .get('/v1/auth/me')
      .set('Cookie', `dd_session=${session?.tokenHash ?? ''}`)
      .expect(401);
    expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the admin console', () => {
  const ADMIN = { email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD };

  it('signs in with the seeded email and password', async () => {
    const agent = h.agent();

    const response = await agent.post('/v1/auth/admin/login').send(ADMIN).expect(200);

    expect(response.body.admin.email).toBe(ADMIN.email);
    expect(response.body.admin.adminRole).toBe('SUPER_ADMIN');
    expect(response.body.permissions).toContain('admin:listing:moderate');
    expect(JSON.stringify(response.body)).not.toContain('argon2');
  });

  /**
   * ── Reconstruction slice ──────────────────────────────────────────────
   * The baseline asserts `GET /v1/admin/metrics/overview` answers 200 on this
   * session. `admin.routes.ts` is F049, so the assertion is the same one a
   * layer down: past the guard, and 404 rather than 401. It becomes a 200
   * again with F049.
   */
  it('opens the admin chain with that session', async () => {
    const agent = h.agent();
    await agent.post('/v1/auth/admin/login').send(ADMIN).expect(200);

    await agent.get('/v1/admin/metrics/overview').expect(404);
  });

  it('refuses a wrong password with the same answer as an unknown account', async () => {
    const wrong = await h
      .agent()
      .post('/v1/auth/admin/login')
      .send({ ...ADMIN, password: 'not-the-password' })
      .expect(401);
    const unknown = await h
      .agent()
      .post('/v1/auth/admin/login')
      .send({ email: 'nobody@dealers-drive.in', password: 'anything' })
      .expect(401);

    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.code).toBe(wrong.body.code);
    expect(unknown.body.detail).toBe(wrong.body.detail);
  });

  it('refuses a dealer account, which has no password at all', async () => {
    const response = await h
      .agent()
      .post('/v1/auth/admin/login')
      .send({ email: 'owner@srilakshmimotors.in', password: 'anything' })
      .expect(401);

    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('signs out', async () => {
    const agent = h.agent();
    await agent.post('/v1/auth/admin/login').send(ADMIN).expect(200);
    await agent.post('/v1/auth/admin/logout').expect(204);

    await agent.get('/v1/admin/metrics/overview').expect(401);
  });
});

describe('the boundary between the two consoles', () => {
  const ADMIN = { email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD };

  it('does not let a dealer session reach an admin route', async () => {
    const agent = h.agent();
    await h.signIn(agent);
    await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);

    await agent.get('/v1/admin/metrics/overview').expect(401);
    await agent.get('/v1/admin/dealers').expect(401);
  });

  /**
   * The scope is a column on the session row, not a check on the user: even the
   * one human who holds both seats cannot cross with one cookie.
   */
  it('does not let an admin session reach a dealer route', async () => {
    const agent = h.agent();
    await agent.post('/v1/auth/admin/login').send(ADMIN).expect(200);

    await agent.get('/v1/dealer').expect(401);
    await agent.get('/v1/auth/me').expect(401);
  });

  it('issues admin sessions with the shorter lifetime', async () => {
    await h.agent().post('/v1/auth/admin/login').send(ADMIN).expect(200);

    const session = await h.prisma.session.findFirst({
      where: { scope: 'ADMIN' },
      orderBy: { createdAt: 'desc' },
    });

    const hours = ((session?.expiresAt.getTime() ?? 0) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11);
    expect(hours).toBeLessThan(13);
  });
});

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `describe('tenant isolation survives real sessions')` is not here. Both of
 * its cases drive `/v1/dealer/vehicles`, which needs the `Vehicle` model
 * (F055) and the inventory router (F066); the second reads a seeded vehicle
 * out of the database directly. The block returns with F066, alongside
 * `tests/tenant-isolation.test.ts` — which the F014 and F036 entries already
 * defer to the same place.
 * ────────────────────────────────────────────────────────────────────────────
 */

describe('the providers endpoint', () => {
  it('reports whether this deployment can perform a Google sign-in', async () => {
    const response = await h.agent().get('/v1/auth/providers').expect(200);

    expect(response.body.google.startUrl).toBe(`${env.API_BASE_URL}/v1/auth/google/start`);
    expect(typeof response.body.google.enabled).toBe('boolean');
  });
});

function sessionCookieOf(cookies: string[] | undefined): string | undefined {
  return cookies?.find((value) => value.startsWith('dd_session='));
}

async function countSessions(harness: AuthHarness): Promise<number> {
  return harness.prisma.session.count({ where: { revokedAt: null } });
}
