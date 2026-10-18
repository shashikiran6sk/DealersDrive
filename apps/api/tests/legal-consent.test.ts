import { randomUUID, createHash } from 'node:crypto';

import {
  ENQUIRY_NOTICE_VERSION,
  LEGAL_VERSION,
  PRIVACY_VERSION,
  LegalDocumentId,
  legalDocumentSnapshot,
  MANUAL_ACTIVATION_DISCLAIMER_VERSION,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { proveEmail } from './sales-kit.js';
import { submitDocumentSet } from './document-uploads.js';
import { COMPLETE_VEHICLE } from './marketplace-fixtures.js';
import { env } from '../src/config/env.js';
import type * as envModule from '../src/config/env.js';
import { documentDigest } from '../src/modules/legal/legal.evidence.js';
import { createSessionService } from '../src/modules/auth/session.service.js';

const legalSetting = vi.hoisted(() => ({ enabled: true }));

vi.mock('../src/config/env.js', async (original) => {
  const actual = await original<typeof envModule>();
  return {
    ...actual,
    env: {
      ...actual.env,
      get LEGAL_ENFORCEMENT_ENABLED() {
        return legalSetting.enabled;
      },
    },
  };
});

let h: AuthHarness;
let sequence = 0;
const accountAgreement = {
  version: LEGAL_VERSION,
  accepted: true,
  privacyAcknowledged: true,
  privacyVersion: PRIVACY_VERSION,
};
const agreement = { ...accountAgreement, authorityConfirmed: true };
const certification = { version: LEGAL_VERSION, certified: true };
const sharing = { version: ENQUIRY_NOTICE_VERSION, granted: true };

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
  const created = await draft.agent.post('/v1/auth/onboarding').send(draft.body).expect(201);
  const id = created.body.dealer.id as string;
  await h.prisma.dealer.update({
    where: { id },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  });
  await draft.agent.post('/v1/legal/dealer/dealer-agreement').send(agreement).expect(200);
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
      receipts.every(
        (event) =>
          event.version === (event.documentId === 'privacy' ? PRIVACY_VERSION : LEGAL_VERSION) &&
          event.digest.length === 64,
      ),
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

  it('Google, OTP and draft creation do not accept dealer obligations', async () => {
    const draft = await pending();
    const status = await draft.agent.get('/v1/legal/account/status').expect(200);
    expect(status.body.termsRequired).toBe(true);
    await draft.agent
      .post('/v1/auth/onboarding')
      .send({ ...draft.body, agreement })
      .expect(400);
    const created = await draft.agent.post('/v1/auth/onboarding').send(draft.body).expect(201);
    expect(await h.prisma.legalEvent.count({ where: { subjectId: created.body.dealer.id } })).toBe(
      0,
    );
    await draft.agent.post('/v1/legal/dealer/dealer-agreement').send(agreement).expect(422);
    await draft.agent.post('/v1/dealer/submit').send({ agreement }).expect(422);
    expect(await h.prisma.legalEvent.count({ where: { subjectId: created.body.dealer.id } })).toBe(
      0,
    );
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
      await h.prisma.legalEvent.count({
        where: { actorId: staff.id, subjectType: 'DEALER', documentId: 'terms' },
      }),
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
    const body = {
      listingSlug: listing.slug,
      recipientId: owner.id,
      message: 'Fixture enquiry only',
    };
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
    expect(events.map((event) => event.action)).toEqual(['DISCLOSE', 'WITHDRAW']);
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

describe('dealership-scoped permission and immutable disclosure evidence', () => {
  it('shares the same grants, enquiries and withdrawal across customer bearer and browser sessions', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const other = await customer();
    const cars = [
      await publicListing(owner.id),
      await publicListing(owner.id),
      await publicListing(owner.id),
    ];
    const session = await createSessionService(h.prisma).issue({
      userId: buyer.id,
      scope: 'CUSTOMER',
      native: true,
    });
    const authorization = `Bearer ${session.token}`;
    const previous = env.NATIVE_CUSTOMER_AUTH_ENABLED;
    env.NATIVE_CUSTOMER_AUTH_ENABLED = true;
    try {
      const first = await h
        .agent()
        .post('/v1/enquiries')
        .set('Authorization', authorization)
        .send({ listingSlug: cars[0]!.slug, recipientId: owner.id, sharing })
        .expect(201);
      const status = await buyer.agent
        .get(`/v1/enquiries/sharing-status?listingSlug=${cars[1]!.slug}`)
        .expect(200);
      expect(status.body.required).toBe(false);
      await buyer.agent
        .post('/v1/enquiries')
        .send({ listingSlug: cars[1]!.slug, recipientId: owner.id })
        .expect(201);
      const history = await h
        .agent()
        .get('/v1/enquiries')
        .set('Authorization', authorization)
        .expect(200);
      expect(history.body.data).toHaveLength(2);
      await other.agent.get(`/v1/enquiries/${first.body.id}`).expect(404);
      const permissions = await h
        .agent()
        .get('/v1/enquiries/sharing-permissions')
        .set('Authorization', authorization)
        .expect(200);
      const grant = permissions.body.data[0].id as string;
      await other.agent.post(`/v1/enquiries/sharing-permissions/${grant}/withdraw`).expect(404);
      await h
        .agent()
        .post(`/v1/enquiries/sharing-permissions/${grant}/withdraw`)
        .set('Authorization', authorization)
        .expect(200);
      expect(
        (
          await buyer.agent
            .get(`/v1/enquiries/sharing-status?listingSlug=${cars[2]!.slug}`)
            .expect(200)
        ).body.required,
      ).toBe(true);
      await h
        .agent()
        .post('/v1/enquiries')
        .set('Authorization', authorization)
        .send({ listingSlug: cars[2]!.slug, recipientId: owner.id })
        .expect(422);
      await buyer.agent
        .post('/v1/enquiries')
        .send({ listingSlug: cars[2]!.slug, recipientId: owner.id, sharing })
        .expect(201);
      expect(
        await h.prisma.contactSharingEvent.count({
          where: { customerId: buyer.id, action: 'GRANT' },
        }),
      ).toBe(2);
    } finally {
      env.NATIVE_CUSTOMER_AUTH_ENABLED = previous;
    }
  });
  it('reuses same-dealership permission only after a fresh enquiry action and never for another dealer', async () => {
    const owner = await dealer();
    const otherDealer = await dealer();
    const buyer = await customer();
    const first = await publicListing(owner.id);
    const second = await publicListing(owner.id);
    const elsewhere = await publicListing(otherDealer.id);
    const status = await buyer.agent
      .get(`/v1/enquiries/sharing-status?listingSlug=${first.slug}`)
      .expect(200);
    expect(status.body).toMatchObject({ required: true, recipientId: owner.id });
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: first.slug, recipientId: owner.id })
      .expect(422);
    const sent = await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: first.slug, recipientId: owner.id, sharing })
      .expect(201);
    const grant = await h.prisma.contactSharingEvent.findFirstOrThrow({
      where: { customerId: buyer.id, dealerId: owner.id, action: 'GRANT' },
    });
    await buyer.agent
      .get(`/v1/enquiries/sharing-status?listingSlug=${second.slug}`)
      .expect(200)
      .then((response) => expect(response.body.required).toBe(false));
    expect(await h.prisma.enquiry.count({ where: { listingId: second.id } })).toBe(0);
    const next = await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: second.slug, recipientId: owner.id })
      .expect(201);
    const rows = await h.prisma.enquiry.findMany({
      where: { id: { in: [sent.body.id, next.body.id] } },
    });
    expect(rows.every((row) => row.sharingGrantId === grant.id)).toBe(true);
    expect(
      await h.prisma.contactSharingEvent.count({
        where: { customerId: buyer.id, action: 'GRANT' },
      }),
    ).toBe(1);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: elsewhere.slug, recipientId: otherDealer.id })
      .expect(422);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: elsewhere.slug, recipientId: owner.id, sharing })
      .expect(409);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: elsewhere.slug, recipientId: otherDealer.id, sharing })
      .expect(201);
    const permissions = await buyer.agent.get('/v1/enquiries/sharing-permissions').expect(200);
    expect(permissions.headers['cache-control']).toBe('no-store');
    expect(permissions.body.data).toHaveLength(2);
    expect(ENQUIRY_NOTICE_VERSION).not.toBe(PRIVACY_VERSION);
    expect(
      permissions.body.data.every(
        (permission: { noticeVersion: string }) =>
          permission.noticeVersion === ENQUIRY_NOTICE_VERSION,
      ),
    ).toBe(true);
    expect(
      await h.prisma.legalEvent.count({
        where: { subjectId: next.body.id, context: `sharing-grant:${grant.id}` },
      }),
    ).toBe(1);
  });

  it('withdraws all enquiries under the grant, preserves history and permits a fresh re-grant', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const unrelated = await customer();
    const cars = await Promise.all([
      publicListing(owner.id),
      publicListing(owner.id),
      publicListing(owner.id),
    ]);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: cars[0].slug, recipientId: owner.id, sharing })
      .expect(201);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: cars[1].slug, recipientId: owner.id })
      .expect(201);
    const grant = await h.prisma.contactSharingEvent.findFirstOrThrow({
      where: { customerId: buyer.id, action: 'GRANT' },
    });
    await unrelated.agent
      .post(`/v1/enquiries/sharing-permissions/${grant.id}/withdraw`)
      .expect(404);
    await buyer.agent.post(`/v1/enquiries/sharing-permissions/${grant.id}/withdraw`).expect(200);
    await buyer.agent.post(`/v1/enquiries/sharing-permissions/${grant.id}/withdraw`).expect(200);
    expect(
      await h.prisma.contactSharingEvent.count({ where: { withdrawnGrantId: grant.id } }),
    ).toBe(1);
    const history = await h.prisma.enquiry.findMany({ where: { sharingGrantId: grant.id } });
    expect(history).toHaveLength(2);
    expect(history.every((row) => row.sharingWithdrawnAt !== null)).toBe(true);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: cars[2].slug, recipientId: owner.id })
      .expect(422);
    const fresh = await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: cars[2].slug, recipientId: owner.id, sharing })
      .expect(201);
    expect(
      (await h.prisma.enquiry.findUniqueOrThrow({ where: { id: fresh.body.id } })).sharingGrantId,
    ).not.toBe(grant.id);
    expect(
      (await h.prisma.contactSharingEvent.findUniqueOrThrow({ where: { id: grant.id } })).createdAt,
    ).toEqual(grant.createdAt);
    await expect(
      h.prisma
        .$executeRaw`UPDATE "contact_sharing_events" SET "purpose" = 'expanded' WHERE "id" = ${grant.id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(
      h.prisma
        .$executeRaw`DELETE FROM "contact_sharing_events" WHERE "withdrawnGrantId" = ${grant.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });

  it('serializes concurrent first enquiries into one grant and one enquiry per explicit car submission', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const cars = await Promise.all([publicListing(owner.id), publicListing(owner.id)]);
    await Promise.all(
      cars.map((car) =>
        buyer.agent
          .post('/v1/enquiries')
          .send({ listingSlug: car.slug, recipientId: owner.id, sharing })
          .expect(201),
      ),
    );
    expect(
      await h.prisma.contactSharingEvent.count({
        where: { customerId: buyer.id, action: 'GRANT' },
      }),
    ).toBe(1);
    const duplicateCar = await publicListing(owner.id);
    const requests = await Promise.all(
      [1, 2].map(() =>
        buyer.agent
          .post('/v1/enquiries')
          .send({ listingSlug: duplicateCar.slug, recipientId: owner.id }),
      ),
    );
    expect(requests.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await h.prisma.enquiry.count({ where: { listingId: duplicateCar.id } })).toBe(1);
  });

  it('serializes withdrawal with reuse and never leaves an enquiry disclosed under a withdrawn grant', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const first = await publicListing(owner.id);
    const second = await publicListing(owner.id);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: first.slug, recipientId: owner.id, sharing })
      .expect(201);
    const grant = await h.prisma.contactSharingEvent.findFirstOrThrow({
      where: { customerId: buyer.id, action: 'GRANT' },
    });
    const [reuse] = await Promise.all([
      buyer.agent.post('/v1/enquiries').send({ listingSlug: second.slug, recipientId: owner.id }),
      buyer.agent.post(`/v1/enquiries/sharing-permissions/${grant.id}/withdraw`).expect(200),
    ]);
    expect([201, 422]).toContain(reuse.status);
    expect(
      await h.prisma.enquiry.count({
        where: { sharingGrantId: grant.id, sharingWithdrawnAt: null },
      }),
    ).toBe(0);
    expect(
      (await buyer.agent.get(`/v1/enquiries/sharing-status?listingSlug=${second.slug}`).expect(200))
        .body.required,
    ).toBe(true);
  });

  it('requires fresh permission after listing transfer and rejects client identity or dealership spoofing', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const otherDealer = await dealer();
    const first = await publicListing(owner.id);
    const moved = await publicListing(owner.id);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: first.slug, recipientId: owner.id, sharing })
      .expect(201);
    const body = { listingSlug: moved.slug, recipientId: owner.id, sharing };
    await h.agent().post('/v1/enquiries').send(body).expect(401);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ ...body, customerId: randomUUID() })
      .expect(400);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ ...body, dealerId: otherDealer.id })
      .expect(400);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ ...body, sharing: { ...sharing, actorId: randomUUID() } })
      .expect(400);
    await h.prisma.vehicle.update({
      where: { id: moved.vehicleId },
      data: { dealerId: otherDealer.id },
    });
    await buyer.agent.post('/v1/enquiries').send(body).expect(409);
    await h.prisma.listing.update({ where: { id: moved.id }, data: { dealerId: otherDealer.id } });
    await buyer.agent.post('/v1/enquiries').send(body).expect(409);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: moved.slug, recipientId: otherDealer.id })
      .expect(422);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: moved.slug, recipientId: otherDealer.id, sharing })
      .expect(201);
  });

  it.each(['expired', 'purpose', 'categories', 'notice'])(
    'rejects %s grants and masks future disclosures',
    async (change) => {
      const owner = await dealer();
      const buyer = await customer();
      const car = await publicListing(owner.id);
      const original = await buyer.agent
        .post('/v1/enquiries')
        .send({ listingSlug: car.slug, recipientId: owner.id, sharing })
        .expect(201);
      const previous = await h.prisma.contactSharingEvent.findFirstOrThrow({
        where: { customerId: buyer.id, action: 'GRANT' },
      });
      await buyer.agent
        .post(`/v1/enquiries/sharing-permissions/${previous.id}/withdraw`)
        .expect(200);
      const invalid = await h.prisma.contactSharingEvent.create({
        data: {
          ...previous,
          id: randomUUID(),
          eventKey: randomUUID(),
          ...(change === 'expired' ? { expiresAt: new Date(0) } : {}),
          ...(change === 'purpose' ? { purpose: 'marketing' } : {}),
          ...(change === 'categories' ? { dataCategories: ['name', 'financial-data'] } : {}),
          ...(change === 'notice' ? { noticeVersion: 'old' } : {}),
        },
      });
      const another = await publicListing(owner.id);
      await buyer.agent
        .post('/v1/enquiries')
        .send({ listingSlug: another.slug, recipientId: owner.id })
        .expect(422);
      const historical = await h.prisma.enquiry.create({
        data: {
          customerId: buyer.id,
          dealerId: owner.id,
          listingId: another.id,
          sharingGrantId: invalid.id,
          message: 'Insufficient scope fixture',
        },
      });
      const inbox = await owner.agent.get('/v1/dealer/enquiries').expect(200);
      const detail = inbox.body.data.find((row: { id: string }) => row.id === historical.id);
      expect(detail.customer.phone).toBeNull();
      expect(detail.message).toBeNull();
      expect(
        await h.prisma.legalEvent.count({ where: { subjectId: original.body.id } }),
      ).toBeGreaterThan(0);
    },
  );
});

describe('final owner acceptance and activation gates', () => {
  it('records once only with successful complete final submission and rejects actor spoofing', async () => {
    const draft = await pending();
    const created = await draft.agent.post('/v1/auth/onboarding').send(draft.body).expect(201);
    const id = created.body.dealer.id as string;
    await submitDocumentSet(draft.agent);
    expect(await h.prisma.legalEvent.count({ where: { subjectId: id } })).toBe(0);
    await draft.agent.post('/v1/dealer/submit').send({}).expect(422);
    await draft.agent
      .post('/v1/dealer/submit')
      .send({ agreement: { ...agreement, actorId: randomUUID() } })
      .expect(400);
    const submissions = await Promise.all(
      [1, 2].map(() => draft.agent.post('/v1/dealer/submit').send({ agreement })),
    );
    expect(submissions.filter((response) => response.status === 200)).toHaveLength(1);
    const evidence = await h.prisma.legalEvent.findMany({
      where: { subjectType: 'DEALER', subjectId: id },
    });
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      documentId: 'terms',
      version: LEGAL_VERSION,
      digest: documentDigest('terms'),
    });
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id } })).status).toBe(
      'PENDING_APPROVAL',
    );
  });
  it('does not infer new consolidated acceptance from legacy policy receipts', async () => {
    const legacy = await pending();
    const created = await legacy.agent.post('/v1/auth/onboarding').send(legacy.body).expect(201);
    const dealerId = created.body.dealer.id as string;
    const member = await h.prisma.dealerMember.findFirstOrThrow({ where: { dealerId } });
    const old = await h.prisma.legalEvent.create({
      data: {
        actorId: member.userId,
        subjectType: 'DEALER',
        subjectId: dealerId,
        documentId: 'dealer',
        version: '1.0-draft.1',
        digest: documentDigest('dealer'),
        action: 'ACCEPT',
        context: 'legacy-fixture',
        eventKey: randomUUID(),
      },
    });
    expect(
      (await legacy.agent.get('/v1/legal/dealer/status').expect(200)).body.dealerRequired,
    ).toBe(true);
    await submitDocumentSet(legacy.agent);
    await legacy.agent.post('/v1/dealer/submit').send({}).expect(422);
    expect(await h.prisma.legalEvent.findUnique({ where: { id: old.id } })).toEqual(old);
  });
});

describe('reviewed publication metadata', () => {
  it('registers exact draft snapshots and never backfills consolidated acceptance', async () => {
    const versions = await h.prisma.legalPolicyVersion.findMany();
    expect(versions).toHaveLength(9);
    for (const row of versions) {
      const id = LegalDocumentId.parse(row.documentId);
      const snapshot = legalDocumentSnapshot(id, row.version);
      expect(snapshot).toBeDefined();
      expect(row.digest).toBe(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'));
      expect(row.publicationState).toBe('DRAFT');
      expect(row.approvalReference).toBeNull();
      expect(row.effectiveAt).toBeNull();
    }
    await expect(
      h.prisma.$executeRaw`UPDATE "legal_policy_versions" SET "publicationState" = 'PUBLISHED'`,
    ).rejects.toThrow(/append-only/);
    await expect(
      h.prisma.legalPolicyVersion.create({
        data: {
          documentId: 'terms',
          version: 'unapproved-draft',
          digest: 'a'.repeat(64),
          publicationState: 'PUBLISHED',
          effectiveAt: new Date(),
          approvalReference: 'fixture',
        },
      }),
    ).rejects.toThrow();
  });
});

describe('verified owner account in assisted onboarding', () => {
  it('attributes representative data and permits activation only after authenticated owner review', async () => {
    h.google.claims = {
      subject: randomUUID(),
      email: env.adminAllowlist[0] ?? '',
      emailVerified: true,
      name: 'Fixture administrator',
    };
    const admin = h.agent();
    await h.signInAdmin(admin);
    const repEmail = `owner-gate-rep-${randomUUID()}@example.test`;
    await admin.post('/v1/admin/members').send({ email: repEmail, role: 'SALES_REP' }).expect(201);
    h.google.claims = {
      subject: randomUUID(),
      email: repEmail,
      emailVerified: true,
      name: 'Fixture representative',
    };
    const rep = h.agent();
    await h.signInAdmin(rep);
    const phone = nextPhone();
    const ownerEmail = `assisted-owner-${randomUUID()}@example.test`;
    const proof = await rep
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: `dev-otp:91${phone}:123456:${randomUUID()}`, consent: true })
      .expect(200);
    const emailProof = await proveEmail(h, rep, ownerEmail);
    const body = {
      phoneTicket: proof.body.phoneTicket,
      emailTicket: emailProof.emailTicket,
      contactName: 'Fixture actual owner',
      legalName: `Assisted ${randomUUID()}`,
      addressLine: '18 Fixture Road',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632007',
      mapsUrl: 'https://maps.app.goo.gl/fixture',
      specialities: ['Used cars'],
    };
    await h.agent().post('/v1/sales/dealers').send(body).expect(401);
    const created = await rep.post('/v1/sales/dealers').send(body).expect(201);
    const id = created.body.id as string;
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT');
    expect(await h.prisma.legalEvent.count({ where: { subjectId: id } })).toBe(0);
    await rep.post(`/v1/sales/dealers/${id}/submit`).send({ agreement }).expect(400);
    await rep.post(`/v1/sales/dealers/${id}/submit`).send({}).expect(422);
    const override = {
      acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
      justification:
        'Fixture activation exception with complete owner verification and supervised review.',
    };
    const refused = await admin
      .post(`/v1/admin/dealers/${id}/activation-override`)
      .send(override)
      .expect(422);
    expect(refused.body.code).toBe('DEALER_AGREEMENT_REQUIRED');
    await submitDocumentSet(rep, `/v1/sales/dealers/${id}`);
    const repUser = await h.prisma.user.findUniqueOrThrow({ where: { email: repEmail } });
    const attribution = await h.prisma.auditLog.findMany({
      where: { dealerId: id, action: 'document.submitted' },
    });
    expect(attribution).toHaveLength(2);
    expect(attribution.every((row) => row.actorId === repUser.id)).toBe(true);
    const identity = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: id, role: 'OWNER', status: 'ACTIVE' },
    });
    expect(identity.userId).not.toBe(repUser.id);
    h.google.claims = {
      subject: randomUUID(),
      email: ownerEmail,
      emailVerified: true,
      name: 'Fixture actual owner',
    };
    const owner = h.agent();
    await h.signIn(owner);
    await owner.post('/v1/dealer/submit').send({ agreement }).expect(200);
    const acceptance = await h.prisma.legalEvent.findFirstOrThrow({
      where: { subjectType: 'DEALER', subjectId: id, documentId: 'terms' },
    });
    expect(acceptance.actorId).toBe(identity.userId);
    await admin.post(`/v1/admin/dealers/${id}/activation-override`).send(override).expect(200);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
  });
});

describe('independent privacy notice version', () => {
  it('preserves an earlier acknowledgment and requires an explicit current notice acknowledgment', async () => {
    const draft = await pending();
    const created = await draft.agent.post('/v1/auth/onboarding').send(draft.body).expect(201);
    const dealerId = created.body.dealer.id as string;
    const member = await h.prisma.dealerMember.findFirstOrThrow({ where: { dealerId } });
    const oldSnapshot = legalDocumentSnapshot('privacy', '2.0-draft.1');
    const historical = await h.prisma.legalEvent.create({
      data: {
        actorId: member.userId,
        subjectType: 'USER',
        subjectId: member.userId,
        documentId: 'privacy',
        version: '2.0-draft.1',
        digest: createHash('sha256').update(JSON.stringify(oldSnapshot)).digest('hex'),
        action: 'ACKNOWLEDGE',
        context: 'historical-privacy-fixture',
        eventKey: randomUUID(),
      },
    });
    expect(
      (await draft.agent.get('/v1/legal/dealer/status').expect(200)).body.privacyRequired,
    ).toBe(true);
    await draft.agent
      .post('/v1/legal/dealer/terms')
      .send({ ...accountAgreement, privacyVersion: '2.0-draft.1' })
      .expect(422);
    await draft.agent.post('/v1/legal/dealer/terms').send(accountAgreement).expect(200);
    expect(
      (await draft.agent.get('/v1/legal/dealer/status').expect(200)).body.privacyRequired,
    ).toBe(false);
    expect(await h.prisma.legalEvent.findUnique({ where: { id: historical.id } })).toEqual(
      historical,
    );
  });
});

describe('enforcement rollback keeps known permission boundaries', () => {
  it('does not let a disabled collection flag bypass an earlier withdrawal', async () => {
    const owner = await dealer();
    const buyer = await customer();
    const first = await publicListing(owner.id);
    const another = await publicListing(owner.id);
    await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: first.slug, recipientId: owner.id, sharing })
      .expect(201);
    const grant = await h.prisma.contactSharingEvent.findFirstOrThrow({
      where: { customerId: buyer.id, action: 'GRANT' },
    });
    await buyer.agent.post(`/v1/enquiries/sharing-permissions/${grant.id}/withdraw`).expect(200);
    legalSetting.enabled = false;
    try {
      await buyer.agent.post('/v1/enquiries').send({ listingSlug: another.slug }).expect(422);
      expect(await h.prisma.enquiry.count({ where: { listingId: another.id } })).toBe(0);
    } finally {
      legalSetting.enabled = true;
    }
  });
});
