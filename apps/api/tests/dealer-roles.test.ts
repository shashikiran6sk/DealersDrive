import type { ListingStatus } from '@prisma/client';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R92 — OWNER, MANAGER and STAFF inside one dealership, enforced by the API.
 *
 * Every agent here is a real signed-in person with a real session cookie, and
 * every assertion is about what the server allows — not what a button shows.
 * The role is read from the membership row on every request, so changing it or
 * removing the member takes effect on the very next call.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let a: Dealership;
let aManager: Dealership;
let aStaff: Dealership;
let b: Dealership;
let bStaff: Dealership;

let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'roles');
  a = await fixtures.dealership();
  aManager = await fixtures.member(a, 'MANAGER');
  aStaff = await fixtures.member(a, 'STAFF');
  b = await fixtures.dealership();
  bStaff = await fixtures.member(b, 'STAFF');
});

afterAll(async () => {
  await h.close();
});

function nextPlate(): string {
  counter += 1;
  return `TN 31 RB ${String(1000 + counter)}`;
}

async function car(owner: Dealership, status: ListingStatus = 'ACTIVE') {
  counter += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN31RC${String(1000 + counter)}`,
      rtoCode: 'TN31',
      make: 'Maruti Suzuki',
      model: 'Swift',
      manufacturingYear: 2021,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status,
      slug: `2021-maruti-swift-roles-${String(counter)}-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  return { vehicleId: vehicle.id, listingId: listing.id, slug: listing.slug ?? '' };
}

async function completeDraft(by: Dealership): Promise<string> {
  const created = await by.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: nextPlate() })
    .expect(201);
  await by.agent
    .patch(`/v1/dealer/vehicles/${String(created.body.id)}`)
    .send(COMPLETE_VEHICLE)
    .expect(200);
  return String(created.body.id);
}

async function customer(): Promise<request.Agent> {
  counter += 1;
  const phone = `98466${String(10000 + counter).slice(-5)}`;
  const agent = h.agent();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:roles-${String(counter)}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Kavya' })
    .expect(201);
  return agent;
}

async function enquiry(of: Dealership): Promise<string> {
  const { slug } = await car(of);
  const buyer = await customer();
  const res = await buyer.post('/v1/enquiries').send({ listingSlug: slug }).expect(201);
  return String(res.body.id);
}

function setEnquiry(by: Dealership, id: string, status: string) {
  return by.agent.patch(`/v1/dealer/enquiries/${id}`).send({ status });
}

describe('every member reaches the workspace with their own role', () => {
  it.each([
    ['OWNER', () => a],
    ['MANAGER', () => aManager],
    ['STAFF', () => aStaff],
  ] as const)('%s', async (role, who) => {
    const me = await who().agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({ next: 'DASHBOARD', role, dealer: { id: a.dealerId } });
    await who().agent.get('/v1/dealer').expect(200);
    await who().agent.get('/v1/dealer/vehicles').expect(200);
    await who().agent.get('/v1/dealer/enquiries').expect(200);
  });
});

describe('listings, by role', () => {
  it('lets STAFF create and edit a draft but not submit it', async () => {
    const id = await completeDraft(aStaff);
    const refused = await aStaff.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(403);
    expect(refused.body.code).toBe('FORBIDDEN');

    const created = await h.prisma.vehicle.findUniqueOrThrow({ where: { id } });
    expect(created).toMatchObject({ dealerId: a.dealerId, createdBy: aStaff.userId });
    const audit = await h.prisma.auditLog.findFirst({
      where: { entityId: id, action: 'vehicle.updated' },
    });
    expect(audit).toMatchObject({ actorId: aStaff.userId, dealerId: a.dealerId });
  });

  it('lets a MANAGER submit a draft STAFF prepared, and records who did', async () => {
    const id = await completeDraft(aStaff);
    const submitted = await aManager.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    expect(submitted.body.listing.status).toBe('PENDING_REVIEW');
    const audit = await h.prisma.auditLog.findFirst({
      where: { action: 'listing.submitted', entityId: submitted.body.listing.id },
    });
    expect(audit).toMatchObject({ actorId: aManager.userId, dealerId: a.dealerId });
  });

  it.each([
    ['reserve', {}],
    ['mark-sold', {}],
    ['withdraw', { reason: 'NO_LONGER_FOR_SALE' }],
  ] as const)('refuses STAFF %s, allows MANAGER', async (path, body) => {
    const { vehicleId, listingId } = await car(a);
    await aStaff.agent.post(`/v1/dealer/vehicles/${vehicleId}/${path}`).send(body).expect(403);
    expect((await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe(
      'ACTIVE',
    );
    await aManager.agent.post(`/v1/dealer/vehicles/${vehicleId}/${path}`).send(body).expect(200);
  });

  it('refuses STAFF asking for a withdrawn car to be relisted', async () => {
    const { vehicleId } = await car(a, 'WITHDRAWN');
    await aStaff.agent
      .post(`/v1/dealer/vehicles/${vehicleId}/request-reactivation`)
      .send({})
      .expect(403);
  });

  it('refuses STAFF deleting a draft, allows OWNER', async () => {
    const created = await aStaff.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: nextPlate() })
      .expect(201);
    await aStaff.agent.delete(`/v1/dealer/vehicles/${String(created.body.id)}`).expect(403);
    await a.agent.delete(`/v1/dealer/vehicles/${String(created.body.id)}`).expect(204);
  });

  it('lets the OWNER do every listing move', async () => {
    const id = await completeDraft(a);
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    const { vehicleId } = await car(a);
    await a.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).send({}).expect(200);
    await a.agent.post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}).expect(200);
  });
});

describe('enquiries, by role', () => {
  it('lets STAFF see the customer and mark a new enquiry contacted, and records who', async () => {
    const id = await enquiry(a);
    const inbox = await aStaff.agent.get('/v1/dealer/enquiries').expect(200);
    const row = inbox.body.data.find((entry: { id: string }) => entry.id === id);
    expect(row.customer).toMatchObject({ name: 'Kavya', phone: expect.stringMatching(/^\+91/) });

    await setEnquiry(aStaff, id, 'CONTACTED').expect(200);
    const stored = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({ status: 'CONTACTED', contactedById: aStaff.userId });
  });

  it.each(['CLOSED', 'SPAM'])('refuses STAFF marking an enquiry %s', async (status) => {
    const id = await enquiry(a);
    await setEnquiry(aStaff, id, 'CONTACTED').expect(200);
    const refused = await setEnquiry(aStaff, id, status).expect(403);
    expect(refused.body.code).toBe('ENQUIRY_ACTION_FORBIDDEN');
    expect((await h.prisma.enquiry.findUniqueOrThrow({ where: { id } })).status).toBe('CONTACTED');
  });

  it('refuses STAFF reopening or un-closing what a manager closed', async () => {
    const id = await enquiry(a);
    await setEnquiry(aManager, id, 'CLOSED').expect(200);
    await setEnquiry(aStaff, id, 'CONTACTED').expect(403);
    await setEnquiry(aStaff, id, 'NEW').expect(403);
  });

  it('lets a MANAGER close, keeping who contacted and recording who closed', async () => {
    const id = await enquiry(a);
    await setEnquiry(aStaff, id, 'CONTACTED').expect(200);
    await setEnquiry(aManager, id, 'CLOSED').expect(200);
    const stored = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({
      status: 'CLOSED',
      contactedById: aStaff.userId,
      closedById: aManager.userId,
      closedAt: expect.any(Date),
    });

    await setEnquiry(a, id, 'NEW').expect(200);
    expect(await h.prisma.enquiry.findUniqueOrThrow({ where: { id } })).toMatchObject({
      closedById: null,
      closedAt: null,
      contactedById: aStaff.userId,
    });
  });

  it('lets STAFF set a status the enquiry already has — a no-op', async () => {
    const id = await enquiry(a);
    await setEnquiry(a, id, 'CLOSED').expect(200);
    await setEnquiry(aStaff, id, 'CLOSED').expect(200);
  });
});

describe('the dealership itself is the owner’s', () => {
  it.each([
    ['MANAGER', () => aManager],
    ['STAFF', () => aStaff],
  ] as const)('refuses %s editing the profile or the documents', async (_role, who) => {
    await who()
      .agent.patch('/v1/dealer')
      .send({ tagline: 'A tagline written by the wrong person.' })
      .expect(403);
    await who().agent.get('/v1/dealer/documents').expect(403);
    await who()
      .agent.post('/v1/dealer/documents/presign')
      .send({ type: 'PAN_CARD', contentType: 'application/pdf', sizeBytes: 1000 })
      .expect(403);
    await who().agent.post('/v1/dealer/submit').expect(403);
  });

  it('lets the OWNER read the documents', async () => {
    await a.agent.get('/v1/dealer/documents').expect(200);
  });
});

describe('tenant isolation across roles', () => {
  it('gives Dealer A STAFF a 404 for Dealer B’s enquiry, read or write', async () => {
    const id = await enquiry(b);
    await setEnquiry(aStaff, id, 'CONTACTED').expect(404);
    const inbox = await aStaff.agent.get('/v1/dealer/enquiries').expect(200);
    expect(inbox.body.data.map((row: { id: string }) => row.id)).not.toContain(id);
    expect((await h.prisma.enquiry.findUniqueOrThrow({ where: { id } })).status).toBe('NEW');
  });

  it('gives Dealer A MANAGER a 404 for Dealer B’s listing, read or write', async () => {
    const { vehicleId, listingId } = await car(b);
    await aManager.agent.get(`/v1/dealer/vehicles/${vehicleId}`).expect(404);
    await aManager.agent
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send({ make: 'Tata' })
      .expect(404);
    await aManager.agent.post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}).expect(404);
    await aManager.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).send({}).expect(404);
    expect((await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe(
      'ACTIVE',
    );
  });

  it('gives Dealer B STAFF a 404 for Dealer A’s draft', async () => {
    const id = await completeDraft(aStaff);
    await bStaff.agent.get(`/v1/dealer/vehicles/${id}`).expect(404);
    await bStaff.agent.patch(`/v1/dealer/vehicles/${id}`).send({ make: 'Tata' }).expect(404);
  });

  it('never lets a body choose the dealership', async () => {
    const refused = await aStaff.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: nextPlate(), dealerId: b.dealerId })
      .expect(400);
    expect(JSON.stringify(refused.body)).toContain('dealerId');
  });
});

describe('a role is read fresh on every request', () => {
  it('takes a demotion from MANAGER to STAFF on the very next call', async () => {
    const arun = await fixtures.member(a, 'MANAGER');
    const { vehicleId } = await car(a);
    const first = await car(a);
    await arun.agent.post(`/v1/dealer/vehicles/${first.vehicleId}/reserve`).send({}).expect(200);

    await h.prisma.dealerMember.update({
      where: { dealerId_userId: { dealerId: a.dealerId, userId: arun.userId } },
      data: { role: 'STAFF' },
    });

    await arun.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).send({}).expect(403);
    const me = await arun.agent.get('/v1/auth/me').expect(200);
    expect(me.body.role).toBe('STAFF');
    expect(me.body.permissions).not.toContain('listing:reserve');
  });

  it('shuts the dealership to a removed member at once, without logging them out', async () => {
    const priya = await fixtures.member(a, 'STAFF');
    await priya.agent.get('/v1/dealer/vehicles').expect(200);

    await h.prisma.dealerMember.update({
      where: { dealerId_userId: { dealerId: a.dealerId, userId: priya.userId } },
      data: { status: 'REMOVED' },
    });

    await priya.agent.get('/v1/dealer/vehicles').expect(401);
    await priya.agent.get('/v1/dealer/enquiries').expect(401);
    expect(
      await h.prisma.session.count({ where: { userId: priya.userId, revokedAt: null } }),
    ).toBeGreaterThan(0);
  });
});

describe('a suspended dealership', () => {
  it('locks every member out, takes its cars off the marketplace, and comes back on reinstatement', async () => {
    const yard = await fixtures.dealership();
    const manager = await fixtures.member(yard, 'MANAGER');
    const staff = await fixtures.member(yard, 'STAFF');
    const { slug } = await car(yard);
    await h.agent().get(`/v1/vehicles/${slug}`).expect(200);

    const admin = await fixtures.moderator();
    await admin
      .post(`/v1/admin/dealers/${yard.dealerId}/suspend`)
      .send({ reason: 'Documents under review.' })
      .expect(200);

    for (const person of [yard, manager, staff]) {
      await person.agent.get('/v1/dealer/vehicles').expect(401);
      await person.agent.get('/v1/dealer/enquiries').expect(401);
      await person.agent.get('/v1/auth/me').expect(401);
    }
    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);

    await admin
      .post(`/v1/admin/dealers/${yard.dealerId}/reinstate`)
      .send({ note: 'Cleared.' })
      .expect(200);
    for (const person of [yard, manager, staff]) {
      await person.agent.get('/v1/dealer/vehicles').expect(200);
    }
    await h.agent().get(`/v1/vehicles/${slug}`).expect(200);
  });

  it('closes only that dealership to a person who belongs to two', async () => {
    const abc = await fixtures.dealership();
    const xyz = await fixtures.dealership();
    const arun = await fixtures.member(abc, 'MANAGER');
    await h.prisma.dealerMember.create({
      data: {
        dealerId: xyz.dealerId,
        userId: arun.userId,
        role: 'STAFF',
        permissions: [],
        createdAt: new Date(Date.now() + 60_000),
      },
    });

    const before = await arun.agent.get('/v1/auth/me').expect(200);
    expect(before.body).toMatchObject({ role: 'MANAGER', dealer: { id: abc.dealerId } });

    await h.prisma.dealer.update({
      where: { id: abc.dealerId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    const after = await arun.agent.get('/v1/auth/me').expect(200);
    expect(after.body).toMatchObject({ role: 'STAFF', dealer: { id: xyz.dealerId } });
    expect(
      await h.prisma.userRole.findFirst({ where: { userId: arun.userId, role: 'DEALER' } }),
    ).toMatchObject({ status: 'ACTIVE' });
  });
});
