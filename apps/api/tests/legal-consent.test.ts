import { randomUUID } from 'node:crypto';

import { LEGAL_VERSION } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE } from './marketplace-fixtures.js';
import { env } from '../src/config/env.js';
import type * as envModule from '../src/config/env.js';
import { documentDigest } from '../src/modules/legal/legal.evidence.js';

vi.mock('../src/config/env.js', async (original) => {
  const actual = await original<typeof envModule>();
  return { ...actual, env: { ...actual.env, LEGAL_ENFORCEMENT_ENABLED: true } };
});

let h: AuthHarness;
let sequence = 0;
const accountAgreement = { version: LEGAL_VERSION, accepted: true, privacyAcknowledged: true };
const agreement = { ...accountAgreement, authorityConfirmed: true };
const certification = { version: LEGAL_VERSION, certified: true };
const sharing = { version: LEGAL_VERSION, granted: true };

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});
afterAll(async () => {
  await h.close();
});
function nextPhone() {
  sequence += 1;
  return `98987${String(10000 + sequence)}`;
}
async function proveCustomer(agent: request.Agent, phone = nextPhone()) {
  const response = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:123456:legal-${randomUUID()}` })
    .expect(200);
  return { phone, signUpToken: response.body.signUpToken as string };
}
async function customer() {
  const agent = h.agent();
  const proof = await proveCustomer(agent);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({
      signUpToken: proof.signUpToken,
      fullName: 'Legal Fixture Buyer',
      agreement: accountAgreement,
    })
    .expect(201);
  return { agent, id: created.body.customer.id as string, phone: proof.phone };
}
async function pending() {
  const stamp = randomUUID();
  h.google.claims = {
    subject: stamp,
    email: `${stamp}@example.test`,
    emailVerified: true,
    name: 'Legal Fixture Owner',
  };
  const agent = h.agent();
  await h.signIn(agent);
  const phone = nextPhone();
  await h.proveNumber(agent, phone);
  return {
    agent,
    body: {
      fullName: 'Legal Fixture Owner',
      phone,
      legalName: `Legal Motors ${stamp}`,
      addressLine: '18 Fixture Road',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632007',
      mapsUrl: 'https://maps.app.goo.gl/fixture',
      tagline: 'A test dealership',
      specialities: ['Used cars'],
    },
  };
}
async function dealer() {
  const draft = await pending();
  const created = await draft.agent
    .post('/v1/auth/onboarding')
    .send({ ...draft.body, agreement })
    .expect(201);
  const id = created.body.dealer.id as string;
  await h.prisma.dealer.update({
    where: { id },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  });
  const member = await h.prisma.dealerMember.findFirstOrThrow({ where: { dealerId: id } });
  return { agent: draft.agent, id, userId: member.userId };
}
async function publicListing(dealerId: string) {
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId,
      registrationNumber: `TN23LC${String(1000 + ++sequence)}`,
      make: 'Hyundai',
      model: 'Creta',
      manufacturingYear: 2023,
    },
  });
  return h.prisma.listing.create({
    data: {
      dealerId,
      vehicleId: vehicle.id,
      status: 'ACTIVE',
      slug: `legal-${randomUUID()}`,
      publishedAt: new Date(),
    },
  });
}

describe('explicit choices, distinct receipts and login', () => {
  it('refuses missing and stale customer choices before consuming proof or creating a session', async () => {
    const agent = h.agent();
    const proof = await proveCustomer(agent);
    const before = await h.prisma.user.count();
    const body = { signUpToken: proof.signUpToken, fullName: 'Fixture Buyer' };
    const missing = await agent.post('/v1/auth/sign-up/customer').send(body).expect(422);
    expect(missing.body.code).toBe('AGREEMENT_REQUIRED');
    expect(missing.headers['set-cookie']).toBeUndefined();
    const stale = await agent
      .post('/v1/auth/sign-up/customer')
      .send({ ...body, agreement: { ...accountAgreement, version: 'old' } })
      .expect(422);
    expect(stale.body.code).toBe('AGREEMENT_VERSION_CHANGED');
    expect(await h.prisma.user.count()).toBe(before);
    const created = await agent
      .post('/v1/auth/sign-up/customer')
      .send({ ...body, agreement: accountAgreement })
      .expect(201);
    const id = created.body.customer.id as string;
    const receipts = await h.prisma.legalEvent.findMany({ where: { actorId: id } });
    expect(receipts.map((event) => [event.documentId, event.action]).sort()).toEqual([
      ['privacy', 'ACKNOWLEDGE'],
      ['terms', 'ACCEPT'],
    ]);
    expect(
      receipts.every((event) => event.version === LEGAL_VERSION && event.digest.length === 64),
    ).toBe(true);
    expect(Object.keys(receipts[0] ?? {})).not.toEqual(
      expect.arrayContaining(['ip', 'userAgent', 'phone', 'email', 'token']),
    );
    await agent.post('/v1/legal/customer/terms').send(accountAgreement).expect(200);
    expect(await h.prisma.legalEvent.count({ where: { actorId: id } })).toBe(2);
    await proveCustomer(h.agent(), proof.phone);
    expect(await h.prisma.legalEvent.count({ where: { actorId: id } })).toBe(2);
    const history = await agent.get('/v1/legal/customer/history').expect(200);
    expect(history.headers['cache-control']).toBe('no-store');
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[0]).not.toHaveProperty('actorId');
  });

  it('Google and OTP do not accept agreements; dealer creation requires explicit authorized-owner choices', async () => {
    const draft = await pending();
    const status = await draft.agent.get('/v1/legal/account/status').expect(200);
    expect(status.body.termsRequired).toBe(true);
    await draft.agent.post('/v1/auth/onboarding').send(draft.body).expect(422);
    await draft.agent
      .post('/v1/auth/onboarding')
      .send({ ...draft.body, agreement: { ...agreement, authorityConfirmed: false } })
      .expect(400);
    const created = await draft.agent
      .post('/v1/auth/onboarding')
      .send({ ...draft.body, agreement })
      .expect(201);
    const events = await h.prisma.legalEvent.findMany({
      where: { subjectId: created.body.dealer.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      documentId: 'dealer',
      action: 'ACCEPT',
      context: 'owner-authority-confirmed',
    });
  });

  it('staff may accept their own Terms but cannot bind the dealership', async () => {
    const owner = await dealer();
    const staff = await customer();
    await h.prisma.dealerMember.create({
      data: { dealerId: owner.id, userId: staff.id, role: 'STAFF' },
    });
    const membership = await h.prisma.dealerMember.findUniqueOrThrow({
      where: { dealerId_userId: { dealerId: owner.id, userId: staff.id } },
    });
    await staff.agent
      .put('/v1/auth/workspaces/current')
      .send({ membershipId: membership.id })
      .expect(200);
    await staff.agent.post('/v1/legal/dealer/dealer-agreement').send(agreement).expect(403);
    await staff.agent.post('/v1/legal/dealer/terms').send(accountAgreement).expect(200);
    expect(
      await h.prisma.legalEvent.count({ where: { actorId: staff.id, documentId: 'dealer' } }),
    ).toBe(0);
    expect((await staff.agent.get('/v1/legal/dealer/status').expect(200)).body.mayBindDealer).toBe(
      false,
    );
  });
});

describe('listing certification', () => {
  it('enforces the declaration and records only a successful state transition, including resubmission', async () => {
    const owner = await dealer();
    const created = await owner.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: `TN23LC${String(1000 + ++sequence)}` })
      .expect(201);
    const id = created.body.id as string;
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({ certification }).expect(422);
    expect(
      await h.prisma.legalEvent.count({
        where: { documentId: 'certification', actorId: owner.userId },
      }),
    ).toBe(0);
    await owner.agent.patch(`/v1/dealer/vehicles/${id}`).send(COMPLETE_VEHICLE).expect(200);
    const missing = await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({}).expect(422);
    expect(missing.body.code).toBe('CERTIFICATION_REQUIRED');
    await owner.agent
      .post(`/v1/dealer/vehicles/${id}/submit`)
      .send({ certification: { ...certification, version: 'old' } })
      .expect(422);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({ certification }).expect(200);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({ certification }).expect(409);
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(listing.status).toBe('PENDING_REVIEW');
    expect(
      await h.prisma.legalEvent.count({ where: { subjectId: listing.id, action: 'CERTIFY' } }),
    ).toBe(1);
    await h.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'CHANGES_REQUESTED' },
    });
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({}).expect(422);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({ certification }).expect(200);
    expect(
      await h.prisma.legalEvent.count({ where: { subjectId: listing.id, action: 'CERTIFY' } }),
    ).toBe(2);
    const other = await dealer();
    await other.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({ certification }).expect(404);
  });
});

describe('sharing and withdrawal', () => {
  it('requires an explicit current sharing choice, scopes withdrawal and suppresses future dealer disclosure', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const other = await customer();
    const listing = await publicListing(owner.id);
    const body = { listingSlug: listing.slug, message: 'Fixture enquiry only' };
    await buyer.agent.post('/v1/enquiries').send(body).expect(422);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ ...body, sharing: { ...sharing, version: 'old' } })
      .expect(422);
    expect(await h.prisma.enquiry.count({ where: { listingId: listing.id } })).toBe(0);
    const created = await buyer.agent
      .post('/v1/enquiries')
      .send({ ...body, sharing })
      .expect(201);
    const id = created.body.id as string;
    await other.agent.post(`/v1/enquiries/${id}/withdraw-sharing`).expect(404);
    await buyer.agent.get(`/v1/enquiries/${id}`).expect(200);
    await other.agent.get(`/v1/enquiries/${id}`).expect(404);
    await buyer.agent
      .post(`/v1/enquiries/${id}/withdraw-sharing`)
      .set('Origin', 'https://untrusted.example')
      .expect(403);
    await buyer.agent.post(`/v1/enquiries/${id}/withdraw-sharing`).expect(200);
    await buyer.agent.post(`/v1/enquiries/${id}/withdraw-sharing`).expect(200);
    const events = await h.prisma.legalEvent.findMany({
      where: { subjectId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((event) => event.action)).toEqual(['GRANT', 'WITHDRAW']);
    expect((await h.prisma.enquiry.findUniqueOrThrow({ where: { id } })).status).toBe('NEW');
    const inbox = await owner.agent.get('/v1/dealer/enquiries').expect(200);
    const row = inbox.body.data.find((item: { id: string }) => item.id === id);
    expect(row).toMatchObject({
      message: null,
      customer: { name: 'Sharing withdrawn', phone: null, callHref: null },
    });
    const dashboard = await owner.agent.get('/v1/dealer/dashboard').expect(200);
    expect(dashboard.body.recentEnquiries.some((item: { id: string }) => item.id === id)).toBe(
      false,
    );
    await h.drainEmails();
    expect(
      h.mailer.sent.some((mail) => JSON.stringify(mail).includes('Fixture enquiry only')),
    ).toBe(false);
    expect(
      (await other.agent.get('/v1/legal/customer/history').expect(200)).body.data.some(
        (event: { subjectId: string }) => event.subjectId === id,
      ),
    ).toBe(false);
  });

  it('declining current Terms does not block complaint and privacy-request submission', async () => {
    const phone = nextPhone();
    const user = await h.prisma.user.create({
      data: {
        phone: `+91${phone}`,
        phoneVerifiedAt: new Date(),
        fullName: 'Legacy fixture buyer',
        roles: { create: { role: 'CUSTOMER' } },
      },
    });
    const agent = h.agent();
    await proveCustomer(agent, phone);
    expect((await agent.get('/v1/legal/customer/status').expect(200)).body.termsRequired).toBe(
      true,
    );
    await agent
      .post('/v1/support/tickets')
      .send({
        category: 'ACCOUNT_ISSUE',
        subject: 'Privacy request',
        description: 'Please review deletion of my test account.',
      })
      .expect(201);
    expect(await h.prisma.legalEvent.count({ where: { actorId: user.id } })).toBe(0);
  });
});

describe('immutable evidence and access boundaries', () => {
  it('rejects database updates, deletes and truncation', async () => {
    const buyer = await customer();
    await expect(
      h.prisma
        .$executeRaw`UPDATE "legal_events" SET "context" = 'rewrite' WHERE "actorId" = ${buyer.id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(
      h.prisma.$executeRaw`DELETE FROM "legal_events" WHERE "actorId" = ${buyer.id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(h.prisma.$executeRawUnsafe('TRUNCATE "legal_events"')).rejects.toThrow(
      /append-only/,
    );
    expect(await h.prisma.legalEvent.count({ where: { actorId: buyer.id } })).toBe(2);
  });

  it('recognizes genuine absorbed-account receipts without rewriting their subjects', async () => {
    const buyer = await customer();
    const absorbed = await h.prisma.user.create({
      data: { status: 'DELETED', mergedIntoId: buyer.id },
    });
    const id = randomUUID();
    await h.prisma.legalEvent.create({
      data: {
        id,
        actorId: absorbed.id,
        subjectType: 'USER',
        subjectId: absorbed.id,
        documentId: 'terms',
        version: LEGAL_VERSION,
        digest: documentDigest('terms'),
        action: 'ACCEPT',
        context: 'test-existing-receipt',
        eventKey: randomUUID(),
      },
    });
    const history = await buyer.agent.get('/v1/legal/customer/history').expect(200);
    expect(history.body.data.find((event: { id: string }) => event.id === id)).toMatchObject({
      subjectId: absorbed.id,
    });
    expect((await h.prisma.legalEvent.findUniqueOrThrow({ where: { id } })).subjectId).toBe(
      absorbed.id,
    );
    await buyer.agent
      .get(`/v1/admin/legal/events?subjectType=USER&subjectId=${buyer.id}`)
      .expect(401);
    await h.agent().get('/v1/legal/customer/history').expect(401);
  });
});

describe('assisted sales and reviewer gates', () => {
  it('requires the owner’s exact revision declaration and never treats a salesperson’s input as acceptance', async () => {
    h.google.claims = {
      subject: `legal-admin-${randomUUID()}`,
      email: env.adminAllowlist[0] ?? '',
      emailVerified: true,
      name: 'Fixture operations',
    };
    const admin = h.agent();
    await h.signInAdmin(admin);
    const email = `legal-sales-${randomUUID()}@example.test`;
    await admin.post('/v1/admin/members').send({ email, role: 'SALES_REP' }).expect(201);
    h.google.claims = {
      subject: randomUUID(),
      email,
      emailVerified: true,
      name: 'Fixture salesperson',
    };
    const sales = h.agent();
    await h.signInAdmin(sales);
    const member = await h.prisma.adminMember.findFirstOrThrow({ where: { user: { email } } });
    const owner = await dealer();
    await h.prisma.dealer.update({
      where: { id: owner.id },
      data: { onboardingSource: 'ASSISTED', assistedByMemberId: member.id },
    });
    const draft = await sales
      .post(`/v1/sales/dealers/${owner.id}/vehicles`)
      .send({ registrationNumber: `TN23LC${String(1000 + ++sequence)}` })
      .expect(201);
    const id = draft.body.id as string;
    await sales
      .patch(`/v1/sales/dealers/${owner.id}/vehicles/${id}`)
      .send(COMPLETE_VEHICLE)
      .expect(200);
    const refused = await sales
      .post(`/v1/sales/dealers/${owner.id}/vehicles/${id}/submit`)
      .send({ certification, agreement })
      .expect(422);
    expect(refused.body.code).toBe('DEALER_CERTIFICATION_REQUIRED');
    await sales.post('/v1/legal/dealer/dealer-agreement').send(agreement).expect(401);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/certify`).send({ certification }).expect(200);
    await sales
      .patch(`/v1/sales/dealers/${owner.id}/vehicles/${id}`)
      .send({ description: 'Updated fixture disclosure' })
      .expect(200);
    await sales.post(`/v1/sales/dealers/${owner.id}/vehicles/${id}/submit`).expect(422);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/certify`).send({ certification }).expect(200);
    await sales.post(`/v1/sales/dealers/${owner.id}/vehicles/${id}/submit`).expect(200);
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    const receipts = await h.prisma.legalEvent.findMany({
      where: { subjectId: listing.id, action: 'CERTIFY' },
    });
    expect(receipts).toHaveLength(2);
    expect(receipts.every((receipt) => receipt.actorId === owner.userId)).toBe(true);
    const notReady = await admin.post(`/v1/admin/listings/${listing.id}/approve`).expect(409);
    expect(notReady.body.code).toBe('LISTING_NOT_READY');
    await h.prisma.vehicle.update({ where: { id }, data: { kilometersDriven: 24000 } });
    const stale = await admin.post(`/v1/admin/listings/${listing.id}/approve`).expect(422);
    expect(stale.body.code).toBe('CERTIFICATION_REQUIRED');
    const evidence = await admin
      .get(`/v1/admin/legal/events?subjectType=LISTING&subjectId=${listing.id}`)
      .expect(200);
    expect(evidence.headers['cache-control']).toBe('no-store');
    expect(evidence.body.data).toHaveLength(2);
    await sales
      .get(`/v1/admin/legal/events?subjectType=LISTING&subjectId=${listing.id}`)
      .expect(403);
  });
});
