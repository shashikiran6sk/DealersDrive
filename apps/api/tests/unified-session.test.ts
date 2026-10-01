import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R93 — one person, one sign-in, every context they have.
 *
 * Before R93 a customer session could never reach the dealer console: the
 * resolver looked only at `scope = 'DEALER'` sessions, so a member who had
 * signed in on the Customer tab was sent to sign in a second time. Now the
 * same session answers both, and nothing about it changes on the way.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let abc: Dealership;
let xyz: Dealership;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'unified');
  abc = await fixtures.dealership();
  xyz = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

interface Person {
  agent: request.Agent;
  userId: string;
}

async function customer(fullName = 'Arun Kumar'): Promise<Person> {
  counter += 1;
  const phone = `94388${String(10000 + counter).slice(-5)}`;
  const agent = h.agent();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:unified-${String(counter)}`,
    })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, userId: String(created.body.customer.id) };
}

async function join(
  person: Person,
  dealership: Dealership,
  role: 'MANAGER' | 'STAFF',
  joinedAt = new Date(),
): Promise<string> {
  const member = await h.prisma.dealerMember.create({
    data: {
      dealerId: dealership.dealerId,
      userId: person.userId,
      role,
      permissions: [],
      createdAt: joinedAt,
    },
  });
  return member.id;
}

async function liveSessions(userId: string): Promise<number> {
  return h.prisma.session.count({ where: { userId, revokedAt: null } });
}

describe('a customer sign-in reaches the dealer console', () => {
  it('opens the workspace with the session they already have — no second sign-in', async () => {
    const arun = await customer();
    await join(arun, abc, 'MANAGER');
    const before = await liveSessions(arun.userId);
    const session = await h.prisma.session.findFirstOrThrow({
      where: { userId: arun.userId, revokedAt: null },
    });
    expect(session.scope).toBe('CUSTOMER');

    const me = await arun.agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      next: 'DASHBOARD',
      role: 'MANAGER',
      dealer: { id: abc.dealerId },
    });
    await arun.agent.get('/v1/dealer/vehicles').expect(200);
    await arun.agent.get('/v1/dealer/enquiries').expect(200);

    // And still a customer, on the same cookie.
    await arun.agent.get('/v1/auth/customer/me').expect(200);
    await arun.agent.get('/v1/saved-vehicles').expect(200);

    expect(await liveSessions(arun.userId)).toBe(before);
  });

  it('refuses a customer who belongs to no dealership — and never offers them onboarding', async () => {
    const kavya = await customer('Kavya');
    await kavya.agent.get('/v1/auth/me').expect(401);
    await kavya.agent.get('/v1/dealer').expect(401);
    await kavya.agent.post('/v1/auth/onboarding').send({}).expect(401);
    await kavya.agent.get('/v1/auth/customer/me').expect(200);
  });

  it('lets a dealer session work as a customer, as before', async () => {
    await abc.agent.get('/v1/auth/customer/me').expect(200);
    await abc.agent.get('/v1/enquiries').expect(200);
  });

  it('logs out of both at once — it is one session', async () => {
    const arun = await customer();
    await join(arun, abc, 'STAFF');
    await arun.agent.get('/v1/dealer').expect(200);

    await arun.agent.post('/v1/auth/logout').expect(204);

    await arun.agent.get('/v1/dealer').expect(401);
    await arun.agent.get('/v1/auth/customer/me').expect(401);
    expect(await liveSessions(arun.userId)).toBe(0);
  });

  it('keeps a removed member signed in as a customer', async () => {
    const priya = await customer('Priya');
    await join(priya, abc, 'STAFF');
    await priya.agent.get('/v1/dealer').expect(200);

    await h.prisma.dealerMember.update({
      where: { dealerId_userId: { dealerId: abc.dealerId, userId: priya.userId } },
      data: { status: 'REMOVED' },
    });

    await priya.agent.get('/v1/dealer').expect(401);
    await priya.agent.get('/v1/auth/customer/me').expect(200);
    const list = await priya.agent.get('/v1/auth/workspaces').expect(200);
    expect(list.body.data).toEqual([]);
  });
});

describe('the workspaces a person has', () => {
  it('is empty for a customer with no dealership', async () => {
    const kavya = await customer('Kavya');
    const list = await kavya.agent.get('/v1/auth/workspaces').expect(200);
    expect(list.body).toEqual({ data: [] });
  });

  it('needs a session', async () => {
    await h.agent().get('/v1/auth/workspaces').expect(401);
  });

  it('lists every dealership with its role, oldest first, the first one current', async () => {
    const arun = await customer();
    await join(arun, abc, 'MANAGER', new Date(Date.now() - 60_000));
    await join(arun, xyz, 'STAFF');

    const list = await arun.agent.get('/v1/auth/workspaces').expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        dealer: expect.objectContaining({ id: abc.dealerId }),
        role: 'MANAGER',
        roleLabel: 'Manager',
        enterable: true,
        current: true,
      }),
      expect.objectContaining({
        dealer: expect.objectContaining({ id: xyz.dealerId }),
        role: 'STAFF',
        enterable: true,
        current: false,
      }),
    ]);
  });

  it('switches dealership on the same session, and the console follows', async () => {
    const arun = await customer();
    await join(arun, abc, 'MANAGER', new Date(Date.now() - 60_000));
    const atXyz = await join(arun, xyz, 'STAFF');
    const before = await liveSessions(arun.userId);

    const switched = await arun.agent
      .put('/v1/auth/workspaces/current')
      .send({ membershipId: atXyz })
      .expect(200);
    expect(switched.body.data.find((row: { current: boolean }) => row.current).dealer.id).toBe(
      xyz.dealerId,
    );

    const me = await arun.agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({ role: 'STAFF', dealer: { id: xyz.dealerId } });
    expect(await liveSessions(arun.userId)).toBe(before);

    const audit = await h.prisma.auditLog.findFirst({
      where: { action: 'auth.workspace.selected', actorId: arun.userId },
    });
    expect(audit).toMatchObject({ dealerId: xyz.dealerId, entityId: atXyz });
  });

  it('records nothing when the dealership chosen is already the current one', async () => {
    const arun = await customer();
    const atAbc = await join(arun, abc, 'MANAGER');
    await arun.agent.put('/v1/auth/workspaces/current').send({ membershipId: atAbc }).expect(200);
    await arun.agent.put('/v1/auth/workspaces/current').send({ membershipId: atAbc }).expect(200);

    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.workspace.selected', actorId: arun.userId },
      }),
    ).toBe(1);
  });

  it('refuses a membership that is not theirs, without saying whose it is', async () => {
    const arun = await customer();
    await join(arun, abc, 'MANAGER');
    const other = await customer('Somebody Else');
    const theirs = await join(other, xyz, 'MANAGER');

    const refused = await arun.agent
      .put('/v1/auth/workspaces/current')
      .send({ membershipId: theirs })
      .expect(404);
    expect(refused.body.code).toBe('WORKSPACE_NOT_FOUND');
    const me = await arun.agent.get('/v1/auth/me').expect(200);
    expect(me.body.dealer.id).toBe(abc.dealerId);
  });

  it('will not choose a dealership by id — only by the person’s own membership', async () => {
    const arun = await customer();
    await join(arun, abc, 'MANAGER');
    await arun.agent
      .put('/v1/auth/workspaces/current')
      .send({ dealerId: xyz.dealerId })
      .expect(400);
  });

  it('lists a suspended dealership as closed, and refuses to enter it', async () => {
    const yard = await fixtures.dealership();
    const arun = await customer();
    const membership = await join(arun, yard, 'MANAGER');
    await h.prisma.dealer.update({
      where: { id: yard.dealerId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    const list = await arun.agent.get('/v1/auth/workspaces').expect(200);
    expect(list.body.data).toEqual([expect.objectContaining({ enterable: false, current: false })]);
    await arun.agent
      .put('/v1/auth/workspaces/current')
      .send({ membershipId: membership })
      .expect(404);
    await arun.agent.get('/v1/dealer').expect(401);
    await arun.agent.get('/v1/auth/customer/me').expect(200);
  });

  it('falls back to another dealership when the chosen one is suspended', async () => {
    const one = await fixtures.dealership();
    const two = await fixtures.dealership();
    const arun = await customer();
    await join(arun, one, 'MANAGER', new Date(Date.now() - 60_000));
    const atTwo = await join(arun, two, 'STAFF');
    await arun.agent.put('/v1/auth/workspaces/current').send({ membershipId: atTwo }).expect(200);

    await h.prisma.dealer.update({
      where: { id: two.dealerId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    const me = await arun.agent.get('/v1/auth/me').expect(200);
    expect(me.body.dealer.id).toBe(one.dealerId);
  });
});
