import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R94 — the owner builds a team by inviting mobile numbers.
 *
 * Everyone here signs in through the real endpoints: owners through onboarding,
 * invited people through the ordinary customer sign-in. An invitation carries
 * no token; what makes it theirs is the number their session proved.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let abc: Dealership;
let xyz: Dealership;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'team');
  abc = await fixtures.dealership();
  xyz = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

interface Person {
  agent: request.Agent;
  userId: string;
  phone: string;
}

function nextNumber(): string {
  counter += 1;
  return `94399${String(10000 + counter).slice(-5)}`;
}

async function signUp(phone: string, fullName = 'Priya Devi'): Promise<Person> {
  const agent = h.agent();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:team-${String(counter)}-${phone}`,
    })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, userId: String(created.body.customer.id), phone: `+91${phone}` };
}

function invite(by: Dealership, phone: string, role: 'MANAGER' | 'STAFF' = 'STAFF') {
  return by.agent.post('/v1/dealer/team/invitations').send({ phone, role });
}

async function invitationsOf(person: Person) {
  const res = await person.agent.get('/v1/invitations').expect(200);
  return res.body.data as { id: string; role: string; dealer: { brandName: string } }[];
}

async function memberRow(dealer: Dealership, userId: string) {
  return h.prisma.dealerMember.findUnique({
    where: { dealerId_userId: { dealerId: dealer.dealerId, userId } },
  });
}

describe('inviting an existing customer', () => {
  it('reaches their account, and accepting adds the dealership to it — no second user', async () => {
    const number = nextNumber();
    const priya = await signUp(number);
    const usersBefore = await h.prisma.user.count();

    const invited = await invite(abc, number, 'STAFF').expect(201);
    expect(invited.body).toMatchObject({ role: 'STAFF', status: 'PENDING' });

    const waiting = await invitationsOf(priya);
    expect(waiting).toEqual([expect.objectContaining({ id: invited.body.id, role: 'STAFF' })]);

    const accepted = await priya.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(200);
    expect(accepted.body).toMatchObject({ role: 'STAFF', roleLabel: 'Staff' });

    expect(await h.prisma.user.count()).toBe(usersBefore);
    expect(await memberRow(abc, priya.userId)).toMatchObject({
      role: 'STAFF',
      status: 'ACTIVE',
      invitedBy: abc.userId,
    });

    // Same session: the dealer console now answers, and the customer account still does.
    const me = await priya.agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({ role: 'STAFF', dealer: { id: abc.dealerId } });
    await priya.agent.get('/v1/auth/customer/me').expect(200);
    expect(await invitationsOf(priya)).toEqual([]);

    const audit = await h.prisma.auditLog.findMany({
      where: { dealerId: abc.dealerId, action: { in: ['member.invited', 'member.joined'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining(['member.invited', 'member.joined']),
    );
    expect(JSON.stringify(audit)).not.toContain(number);
  });
});

describe('inviting a number that has never signed in', () => {
  it('waits for that number, which signs up with the ordinary OTP and joins without onboarding', async () => {
    const number = nextNumber();
    const invited = await invite(abc, number, 'MANAGER').expect(201);
    expect(await h.prisma.user.findUnique({ where: { phone: `+91${number}` } })).toBeNull();

    const arun = await signUp(number, 'Arun Kumar');
    const waiting = await invitationsOf(arun);
    expect(waiting).toEqual([
      expect.objectContaining({ id: invited.body.id, role: 'MANAGER', dealer: expect.any(Object) }),
    ]);

    await arun.agent.post(`/v1/invitations/${String(invited.body.id)}/accept`).expect(200);
    const me = await arun.agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({ next: 'DASHBOARD', role: 'MANAGER' });
  });
});

describe('who may accept', () => {
  it('refuses someone whose verified number is not the invited one — the id alone proves nothing', async () => {
    const invited = await invite(abc, nextNumber()).expect(201);
    const stranger = await signUp(nextNumber(), 'Somebody Else');

    const refused = await stranger.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(404);
    expect(refused.body.code).toBe('INVITATION_NOT_FOUND');
    expect(await invitationsOf(stranger)).toEqual([]);
    expect(await memberRow(abc, stranger.userId)).toBeNull();
  });

  it('needs a session', async () => {
    const invited = await invite(abc, nextNumber()).expect(201);
    await h.agent().get('/v1/invitations').expect(401);
    await h
      .agent()
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(401);
  });

  it('does nothing on a replay', async () => {
    const number = nextNumber();
    const priya = await signUp(number);
    const invited = await invite(abc, number).expect(201);
    await priya.agent.post(`/v1/invitations/${String(invited.body.id)}/accept`).expect(200);

    const again = await priya.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(409);
    expect(again.body.code).toBe('INVITATION_CLOSED');
  });

  it('refuses an expired invitation', async () => {
    const number = nextNumber();
    const priya = await signUp(number);
    const invited = await invite(abc, number).expect(201);
    await h.prisma.dealerInvitation.update({
      where: { id: String(invited.body.id) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await invitationsOf(priya)).toEqual([]);
    const refused = await priya.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(409);
    expect(refused.body.code).toBe('INVITATION_EXPIRED');
    const team = await abc.agent.get('/v1/dealer/team').expect(200);
    expect(
      team.body.invitations.find((row: { id: string }) => row.id === invited.body.id),
    ).toMatchObject({ status: 'EXPIRED' });
  });

  it('refuses an invitation the owner withdrew', async () => {
    const number = nextNumber();
    const priya = await signUp(number);
    const invited = await invite(abc, number).expect(201);
    await abc.agent.delete(`/v1/dealer/team/invitations/${String(invited.body.id)}`).expect(204);

    expect(await invitationsOf(priya)).toEqual([]);
    const refused = await priya.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(409);
    expect(refused.body.code).toBe('INVITATION_CLOSED');
    await abc.agent.delete(`/v1/dealer/team/invitations/${String(invited.body.id)}`).expect(404);
  });

  it('lets the invited person decline, after which it cannot be accepted', async () => {
    const number = nextNumber();
    const priya = await signUp(number);
    const invited = await invite(abc, number).expect(201);
    await priya.agent.post(`/v1/invitations/${String(invited.body.id)}/decline`).expect(204);
    await priya.agent.post(`/v1/invitations/${String(invited.body.id)}/accept`).expect(409);
    expect(await memberRow(abc, priya.userId)).toBeNull();
  });

  it('refuses joining a dealership that has been suspended since the invitation', async () => {
    const yard = await fixtures.dealership();
    const number = nextNumber();
    const priya = await signUp(number);
    const invited = await invite(yard, number).expect(201);
    await h.prisma.dealer.update({
      where: { id: yard.dealerId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    expect(await invitationsOf(priya)).toEqual([]);
    const refused = await priya.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(409);
    expect(refused.body.code).toBe('DEALERSHIP_NOT_ACCEPTING');
  });
});

describe('the owner’s invitations', () => {
  it('keeps one waiting invitation per number — inviting again renews it with the new role', async () => {
    const number = nextNumber();
    const first = await invite(abc, number, 'STAFF').expect(201);
    const second = await invite(
      abc,
      ` ${number.slice(0, 5)} ${number.slice(5)} `,
      'MANAGER',
    ).expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.role).toBe('MANAGER');
    expect(
      await h.prisma.dealerInvitation.count({
        where: { dealerId: abc.dealerId, phone: `+91${number}`, status: 'PENDING' },
      }),
    ).toBe(1);
  });

  it('keeps one waiting invitation when two arrive at once', async () => {
    const number = nextNumber();
    const results = await Promise.all([invite(abc, number), invite(abc, number, 'MANAGER')]);
    expect(results.map((res) => res.status).sort()).toEqual([201, 201]);
    expect(
      await h.prisma.dealerInvitation.count({
        where: { dealerId: abc.dealerId, phone: `+91${number}`, status: 'PENDING' },
      }),
    ).toBe(1);
  });

  it('refuses inviting a number that is already a member — including the owner’s own', async () => {
    const owner = await h.prisma.user.findUniqueOrThrow({ where: { id: abc.userId } });
    const refused = await invite(abc, owner.phone?.slice(3) ?? '').expect(409);
    expect(refused.body.code).toBe('MEMBER_ALREADY_EXISTS');
  });

  it('never hands out OWNER, and rejects an unknown field', async () => {
    await abc.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone: nextNumber(), role: 'OWNER' })
      .expect(400);
    await abc.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone: nextNumber(), role: 'STAFF', dealerId: xyz.dealerId })
      .expect(400);
    await abc.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone: '12345', role: 'STAFF' })
      .expect(400);
  });

  it('lets two people accept their own invitations to the same dealership at the same moment', async () => {
    const one = nextNumber();
    const two = nextNumber();
    const [a, b] = await Promise.all([signUp(one, 'One'), signUp(two, 'Two')]);
    const [ia, ib] = await Promise.all([invite(xyz, one), invite(xyz, two)]);
    const results = await Promise.all([
      a.agent.post(`/v1/invitations/${String(ia.body.id)}/accept`),
      b.agent.post(`/v1/invitations/${String(ib.body.id)}/accept`),
    ]);
    expect(results.map((res) => res.status)).toEqual([200, 200]);
  });

  it('turns two simultaneous accepts of one invitation into one membership', async () => {
    const number = nextNumber();
    const priya = await signUp(number);
    const invited = await invite(xyz, number).expect(201);
    const results = await Promise.all([
      priya.agent.post(`/v1/invitations/${String(invited.body.id)}/accept`),
      priya.agent.post(`/v1/invitations/${String(invited.body.id)}/accept`),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(
      await h.prisma.dealerMember.count({
        where: { dealerId: xyz.dealerId, userId: priya.userId },
      }),
    ).toBe(1);
  });
});

describe('managing members', () => {
  async function staffMember(of: Dealership) {
    const number = nextNumber();
    const person = await signUp(number);
    const invited = await invite(of, number, 'STAFF').expect(201);
    const accepted = await person.agent
      .post(`/v1/invitations/${String(invited.body.id)}/accept`)
      .expect(200);
    return { ...person, membershipId: String(accepted.body.membershipId) };
  }

  it('shows the owner the team with roles and contact details, owner first', async () => {
    const priya = await staffMember(abc);
    const team = await abc.agent.get('/v1/dealer/team').expect(200);
    expect(team.body.members[0]).toMatchObject({ role: 'OWNER', isYou: true, manageable: false });
    expect(team.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: priya.membershipId,
          name: 'Priya Devi',
          role: 'STAFF',
          phoneDisplay: expect.stringContaining('+91'),
          manageable: true,
        }),
      ]),
    );
  });

  it('promotes and demotes, and the member feels it on their next request', async () => {
    const priya = await staffMember(abc);
    const { vehicleId } = await activeCar(abc);
    await priya.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).send({}).expect(403);

    await abc.agent
      .patch(`/v1/dealer/team/members/${priya.membershipId}`)
      .send({ role: 'MANAGER' })
      .expect(200);
    await priya.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).send({}).expect(200);

    await abc.agent
      .patch(`/v1/dealer/team/members/${priya.membershipId}`)
      .send({ role: 'STAFF' })
      .expect(200);
    const me = await priya.agent.get('/v1/auth/me').expect(200);
    expect(me.body.role).toBe('STAFF');

    const changes = await h.prisma.auditLog.findMany({
      where: { action: 'member.role_changed', entityId: priya.membershipId },
    });
    expect(changes).toHaveLength(2);
  });

  it('removes a member, who keeps their customer account but loses the dealership at once', async () => {
    const priya = await staffMember(abc);
    await priya.agent.get('/v1/dealer').expect(200);

    await abc.agent.delete(`/v1/dealer/team/members/${priya.membershipId}`).expect(204);

    await priya.agent.get('/v1/dealer').expect(401);
    await priya.agent.get('/v1/auth/customer/me').expect(200);
    expect(await memberRow(abc, priya.userId)).toMatchObject({
      status: 'REMOVED',
      removedBy: abc.userId,
      removedAt: expect.any(Date),
    });
    const team = await abc.agent.get('/v1/dealer/team').expect(200);
    expect(team.body.members.map((row: { id: string }) => row.id)).not.toContain(
      priya.membershipId,
    );
  });

  it('lets a removed member come back only through a new invitation, reusing their old row', async () => {
    const priya = await staffMember(abc);
    const old = await h.prisma.dealerInvitation.findFirstOrThrow({
      where: { dealerId: abc.dealerId, phone: priya.phone, status: 'ACCEPTED' },
    });
    await abc.agent.delete(`/v1/dealer/team/members/${priya.membershipId}`).expect(204);

    await priya.agent.post(`/v1/invitations/${old.id}/accept`).expect(409);
    await priya.agent.get('/v1/dealer').expect(401);

    const again = await invite(abc, priya.phone.slice(3), 'MANAGER').expect(201);
    await priya.agent.post(`/v1/invitations/${String(again.body.id)}/accept`).expect(200);
    expect(await memberRow(abc, priya.userId)).toMatchObject({
      id: priya.membershipId,
      status: 'ACTIVE',
      role: 'MANAGER',
      removedAt: null,
    });
  });

  it('never lets the owner be demoted or removed', async () => {
    const owner = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: abc.dealerId, role: 'OWNER' },
    });
    const demote = await abc.agent
      .patch(`/v1/dealer/team/members/${owner.id}`)
      .send({ role: 'STAFF' })
      .expect(409);
    expect(demote.body.code).toBe('OWNER_LOCKED');
    await abc.agent.delete(`/v1/dealer/team/members/${owner.id}`).expect(409);
    await abc.agent
      .patch(`/v1/dealer/team/members/${owner.id}`)
      .send({ role: 'OWNER' })
      .expect(400);
    expect(
      await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: owner.id } }),
    ).toMatchObject({ role: 'OWNER', status: 'ACTIVE' });
  });
});

describe('only the owner manages the team', () => {
  it.each(['MANAGER', 'STAFF'] as const)('refuses a %s every team route', async (role) => {
    const member = await fixtures.member(abc, role);
    const target = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: abc.dealerId, userId: member.userId },
    });
    await member.agent.get('/v1/dealer/team').expect(403);
    await member.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone: nextNumber(), role: 'STAFF' })
      .expect(403);
    await member.agent
      .patch(`/v1/dealer/team/members/${target.id}`)
      .send({ role: 'MANAGER' })
      .expect(403);
    await member.agent.delete(`/v1/dealer/team/members/${target.id}`).expect(403);
    expect(
      await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: target.id } }),
    ).toMatchObject({ role, status: 'ACTIVE' });
  });
});

describe('another dealership’s team', () => {
  it('is a 404 to an owner — members and invitations alike', async () => {
    const xyzStaff = await fixtures.member(xyz, 'STAFF');
    const target = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: xyz.dealerId, userId: xyzStaff.userId },
    });
    const xyzInvite = await invite(xyz, nextNumber()).expect(201);

    await abc.agent
      .patch(`/v1/dealer/team/members/${target.id}`)
      .send({ role: 'MANAGER' })
      .expect(404);
    await abc.agent.delete(`/v1/dealer/team/members/${target.id}`).expect(404);
    await abc.agent.delete(`/v1/dealer/team/invitations/${String(xyzInvite.body.id)}`).expect(404);

    const team = await abc.agent.get('/v1/dealer/team').expect(200);
    expect(team.body.members.map((row: { id: string }) => row.id)).not.toContain(target.id);
    expect(team.body.invitations.map((row: { id: string }) => row.id)).not.toContain(
      xyzInvite.body.id,
    );
    expect(
      await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: target.id } }),
    ).toMatchObject({ role: 'STAFF', status: 'ACTIVE' });
  });
});

let plate = 0;
async function activeCar(owner: Dealership) {
  plate += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN41TM${String(1000 + plate)}`,
      make: 'Tata',
      model: 'Nexon',
    },
  });
  await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status: 'ACTIVE',
      slug: `tata-nexon-team-${String(plate)}-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  return { vehicleId: vehicle.id };
}
