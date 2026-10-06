import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R96 — the last pass over multi-member dealerships: every route that takes an
 * id, walked from another dealership by every role; the races the earlier
 * suites name, run for real; and the limits that keep one owner's mistake from
 * becoming a table full of rows.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let a: Dealership;
let aManager: Dealership;
let aStaff: Dealership;
let b: Dealership;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'hardening');
  a = await fixtures.dealership();
  aManager = await fixtures.member(a, 'MANAGER');
  aStaff = await fixtures.member(a, 'STAFF');
  b = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

function nextNumber(): string {
  counter += 1;
  return `94422${String(10000 + counter).slice(-5)}`;
}

async function car(owner: Dealership, status: 'ACTIVE' | 'DRAFT' = 'ACTIVE') {
  counter += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN61HD${String(1000 + counter)}`,
      make: 'Toyota',
      model: 'Innova',
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status,
      ...(status === 'ACTIVE'
        ? {
            slug: `toyota-innova-hardening-${String(counter)}-${Date.now().toString(36)}`,
            publishedAt: new Date(),
          }
        : {}),
    },
  });
  return { vehicleId: vehicle.id, listingId: listing.id, slug: listing.slug };
}

async function enquiryFor(owner: Dealership): Promise<string> {
  const { slug } = await car(owner);
  const phone = nextNumber();
  const buyer = h.agent();
  const proved = await buyer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:hardening-${String(counter)}`,
    })
    .expect(200);
  await buyer
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Lakshmi' })
    .expect(201);
  const sent = await buyer
    .post('/v1/enquiries')
    .send({ listingSlug: slug ?? '' })
    .expect(201);
  return String(sent.body.id);
}

describe('every id-taking dealer route, from another dealership', () => {
  it.each([
    ['OWNER', () => a],
    ['MANAGER', () => aManager],
    ['STAFF', () => aStaff],
  ] as const)(
    'answers a %s of Dealer A with 404 for Dealer B’s rows, and changes nothing',
    async (_role, who) => {
      const live = await car(b);
      const draft = await car(b, 'DRAFT');
      const enquiryId = await enquiryFor(b);
      const bMember = await fixtures.member(b, 'STAFF');
      const bMembership = await h.prisma.dealerMember.findFirstOrThrow({
        where: { dealerId: b.dealerId, userId: bMember.userId },
      });
      const bInvitation = await b.agent
        .post('/v1/dealer/team/invitations')
        .send({ phone: nextNumber(), role: 'STAFF' })
        .expect(201);

      const agent: request.Agent = who().agent;
      const attempts: [string, () => request.Test][] = [
        ['GET vehicle', () => agent.get(`/v1/dealer/vehicles/${live.vehicleId}`)],
        [
          'PATCH draft',
          () => agent.patch(`/v1/dealer/vehicles/${draft.vehicleId}`).send({ make: 'X' }),
        ],
        ['DELETE draft', () => agent.delete(`/v1/dealer/vehicles/${draft.vehicleId}`)],
        ['submit', () => agent.post(`/v1/dealer/vehicles/${draft.vehicleId}/submit`)],
        ['reserve', () => agent.post(`/v1/dealer/vehicles/${live.vehicleId}/reserve`).send({})],
        ['mark-sold', () => agent.post(`/v1/dealer/vehicles/${live.vehicleId}/mark-sold`).send({})],
        [
          'withdraw',
          () =>
            agent
              .post(`/v1/dealer/vehicles/${live.vehicleId}/withdraw`)
              .send({ reason: 'NO_LONGER_FOR_SALE' }),
        ],
        [
          'enquiry',
          () => agent.patch(`/v1/dealer/enquiries/${enquiryId}`).send({ status: 'CONTACTED' }),
        ],
        [
          'member role',
          () => agent.patch(`/v1/dealer/team/members/${bMembership.id}`).send({ role: 'MANAGER' }),
        ],
        ['member remove', () => agent.delete(`/v1/dealer/team/members/${bMembership.id}`)],
        [
          'invitation',
          () => agent.delete(`/v1/dealer/team/invitations/${String(bInvitation.body.id)}`),
        ],
      ];

      for (const [label, attempt] of attempts) {
        const res = await attempt();
        // A role that lacks the permission is refused before the row is looked
        // up (403); one that has it never finds the row (404). Neither is a 200.
        expect([403, 404], `${label} answered ${String(res.status)}`).toContain(res.status);
        expect(JSON.stringify(res.body)).not.toContain(b.dealerId);
      }

      expect(
        await h.prisma.listing.findUniqueOrThrow({ where: { id: live.listingId } }),
      ).toMatchObject({ status: 'ACTIVE' });
      expect(
        await h.prisma.listing.findUniqueOrThrow({ where: { id: draft.listingId } }),
      ).toMatchObject({ status: 'DRAFT' });
      expect(
        await h.prisma.vehicle.findUniqueOrThrow({ where: { id: draft.vehicleId } }),
      ).toMatchObject({ make: 'Toyota' });
      expect(await h.prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } })).toMatchObject({
        status: 'NEW',
      });
      expect(
        await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: bMembership.id } }),
      ).toMatchObject({ role: 'STAFF', status: 'ACTIVE' });
      expect(
        await h.prisma.dealerInvitation.findUniqueOrThrow({
          where: { id: String(bInvitation.body.id) },
        }),
      ).toMatchObject({ status: 'PENDING' });
    },
  );

  it('lists only Dealer A’s rows on every list route', async () => {
    const theirs = await car(b);
    const theirEnquiry = await enquiryFor(b);
    for (const who of [a, aManager, aStaff]) {
      const inventory = await who.agent.get('/v1/dealer/vehicles').expect(200);
      expect(inventory.body.data.map((row: { id: string }) => row.id)).not.toContain(
        theirs.vehicleId,
      );
      const inbox = await who.agent.get('/v1/dealer/enquiries?status=NEW').expect(200);
      expect(inbox.body.data.map((row: { id: string }) => row.id)).not.toContain(theirEnquiry);
    }
    const team = await a.agent.get('/v1/dealer/team').expect(200);
    for (const member of team.body.members as { id: string }[]) {
      const row = await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.dealerId).toBe(a.dealerId);
    }
  });
});

describe('races', () => {
  it('lets one of two simultaneous status changes on an enquiry win, never a mix', async () => {
    const id = await enquiryFor(a);
    const results = await Promise.all([
      aManager.agent.patch(`/v1/dealer/enquiries/${id}`).send({ status: 'CLOSED' }),
      a.agent.patch(`/v1/dealer/enquiries/${id}`).send({ status: 'SPAM' }),
    ]);
    expect(results.map((res) => res.status)).toEqual([200, 200]);

    const stored = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
    expect(['CLOSED', 'SPAM']).toContain(stored.status);
    // The stamps agree with whichever won.
    expect(stored.closedById === null).toBe(stored.status !== 'CLOSED');
    const audit = await h.prisma.auditLog.count({
      where: { entityId: id, action: { in: ['enquiry.closed', 'enquiry.spam'] } },
    });
    expect(audit).toBe(2);
  });

  it('sells or withdraws a car, never both, when two members try at once', async () => {
    const { vehicleId, listingId } = await car(a);
    const results = await Promise.all([
      aManager.agent.post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}),
      a.agent
        .post(`/v1/dealer/vehicles/${vehicleId}/withdraw`)
        .send({ reason: 'NO_LONGER_FOR_SALE' }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const stored = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(['SOLD', 'WITHDRAWN']).toContain(stored.status);
  });

  it('settles a role change racing a removal on one row, and the member is out', async () => {
    const member = await fixtures.member(a, 'STAFF');
    const row = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: a.dealerId, userId: member.userId },
    });
    const results = await Promise.all([
      a.agent.patch(`/v1/dealer/team/members/${row.id}`).send({ role: 'MANAGER' }),
      a.agent.delete(`/v1/dealer/team/members/${row.id}`),
    ]);
    expect(results.map((res) => res.status)).toContain(204);
    expect(await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
      status: 'REMOVED',
    });
    await member.agent.get('/v1/dealer').expect(401);
  });

  it('never lets an accept outrun a withdrawal into a membership', async () => {
    const phone = nextNumber();
    const invitee = h.agent();
    const proved = await invitee
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:hardening-race-${phone}`,
      })
      .expect(200);
    const created = await invitee
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proved.body.signUpToken, fullName: 'Race' })
      .expect(201);
    const invited = await a.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone, role: 'STAFF' })
      .expect(201);

    const [accepted, revoked] = await Promise.all([
      invitee.post(`/v1/invitations/${String(invited.body.id)}/accept`),
      a.agent.delete(`/v1/dealer/team/invitations/${String(invited.body.id)}`),
    ]);
    const member = await h.prisma.dealerMember.findFirst({
      where: { dealerId: a.dealerId, userId: String(created.body.customer.id) },
    });
    const invitation = await h.prisma.dealerInvitation.findUniqueOrThrow({
      where: { id: String(invited.body.id) },
    });

    if (accepted.status === 200) {
      expect(revoked.status).toBe(404);
      expect(invitation.status).toBe('ACCEPTED');
      expect(member?.status).toBe('ACTIVE');
    } else {
      expect(revoked.status).toBe(204);
      expect(invitation.status).toBe('REVOKED');
      expect(member).toBeNull();
    }
  });
});

describe('limits', () => {
  it('stops an owner at 25 waiting invitations, and counts a renewal as none', async () => {
    const owner = await fixtures.dealership();
    const numbers = Array.from({ length: 25 }, () => nextNumber());
    for (const phone of numbers) {
      await owner.agent
        .post('/v1/dealer/team/invitations')
        .send({ phone, role: 'STAFF' })
        .expect(201);
    }
    const refused = await owner.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone: nextNumber(), role: 'STAFF' })
      .expect(409);
    expect(refused.body.code).toBe('TOO_MANY_INVITATIONS');

    // Renewing one already waiting is not a new invitation.
    await owner.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone: numbers[0], role: 'MANAGER' })
      .expect(201);
  });
});
