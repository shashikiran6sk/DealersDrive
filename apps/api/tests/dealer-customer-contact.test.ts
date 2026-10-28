import type * as EnvModule from '../src/config/env.js';
import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  refreshAllDealerResponseTimes,
  refreshDealerResponseTime,
} from '../src/modules/enquiries/enquiry-response-time.js';
import { withTransaction } from '../src/platform/db/tenant-tx.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

const rateLimitState = vi.hoisted(() => ({ enabled: false }));
vi.mock('../src/config/env.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvModule>();
  return {
    ...original,
    env: {
      ...original.env,
      get RATE_LIMIT_ENABLED() {
        return rateLimitState.enabled;
      },
    },
  };
});

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let reviewer: request.Agent;
let buyer: Dealership;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'customer-contact');
  reviewer = await fixtures.staff('MODERATOR');
  buyer = await fixtures.dealership();
});
afterAll(async () => {
  await h.close();
});

async function car(dealer: Dealership) {
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: dealer.dealerId,
      registrationNumber: `CONTACT${randomUUID()}`,
      make: 'Hyundai',
      model: 'Creta',
      manufacturingYear: 2023,
    },
  });
  return h.prisma.listing.create({
    data: {
      dealerId: dealer.dealerId,
      vehicleId: vehicle.id,
      status: 'ACTIVE',
      slug: `customer-contact-${randomUUID()}`,
      publishedAt: new Date(),
    },
  });
}
function reveal(agent: request.Agent, slug: string | null) {
  return agent.post(`/v1/vehicles/${slug}/reveal-contact`).send({});
}
async function propose(dealer: Dealership, landline: string | null) {
  const response = await dealer.agent
    .patch('/v1/dealer')
    .send({ contact: { landline } })
    .expect(200);
  return String(response.body.profileChange.id);
}
async function approve(changeId: string) {
  await reviewer.post(`/v1/admin/profile-changes/${changeId}/approve`).send({}).expect(200);
}

async function approvedDealer() {
  const dealer = await fixtures.dealership();
  await approve(await propose(dealer, '0416 224 8890'));
  return dealer;
}

describe('approved customer contact numbers', () => {
  it('accepts a callback enquiry with its message when no optional contact number exists', async () => {
    const dealer = await fixtures.dealership();
    const listing = await car(dealer);
    const response = await h.agent().get(`/v1/vehicles/${listing.slug}`).expect(200);
    expect(response.body.dealer.canCall).toBe(false);
    await reveal(buyer.agent, listing.slug).expect(404);
    const sent = await buyer.agent
      .post('/v1/enquiries')
      .send({ listingSlug: listing.slug, message: 'Please call me about this car tomorrow.' })
      .expect(201);
    const enquiry = await h.prisma.enquiry.findUniqueOrThrow({
      where: { id: String(sent.body.id) },
    });
    expect(enquiry.message).toBe('Please call me about this car tomorrow.');
    expect(enquiry.customerId).toBe(buyer.userId);
    expect(enquiry.status).toBe('NEW');
  });

  it('keeps legacy and login numbers private until the dealer confirms and admin approves', async () => {
    const dealer = await fixtures.dealership();
    const listing = await car(dealer);
    await h.prisma.dealer.update({
      where: { id: dealer.dealerId },
      data: { landline: '+914162248890' },
    });
    await reveal(h.agent(), listing.slug).expect(401);
    const unavailable = await reveal(buyer.agent, listing.slug).expect(404);
    expect(unavailable.body.code).toBe('CONTACT_UNAVAILABLE');
    const before = await h.agent().get(`/v1/vehicles/${listing.slug}`).expect(200);
    expect(before.body.dealer.canCall).toBe(false);
    expect(JSON.stringify(before.body)).not.toMatch(/224.?8890|landline|contactPhone/);

    const id = await propose(dealer, '0416 224 8890');
    await reveal(buyer.agent, listing.slug).expect(404);
    await approve(id);
    const unchanged = await dealer.agent
      .patch('/v1/dealer')
      .send({ contact: { landline: '0416 224 8890' } })
      .expect(200);
    expect(unchanged.body.profileChange).toBeNull();
    const response = await reveal(buyer.agent, listing.slug).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.phone).toBe('+914162248890');
    expect(response.body.callHref).toBe('tel:+914162248890');
    expect(await h.prisma.enquiry.count({ where: { listingId: listing.id } })).toBe(0);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: listing.id, action: 'dealer.contact_revealed', actorId: buyer.userId },
      }),
    ).toBe(1);
    const publicResponse = await h.agent().get(`/v1/vehicles/${listing.slug}`).expect(200);
    expect(publicResponse.body.dealer.canCall).toBe(true);
    expect(JSON.stringify(publicResponse.body)).not.toContain('4162248890');
    const persisted = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(persisted.landlineApprovedAt).toBeInstanceOf(Date);
    expect(persisted.status).toBe('ACTIVE');
  });

  it('allows draft contact edits and removal but locks submitted applications', async () => {
    const dealer = await fixtures.dealership('DRAFT');
    await dealer.agent
      .patch('/v1/dealer')
      .send({ contact: { landline: '0416 224 8890' } })
      .expect(200);
    let stored = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(stored.landlineConfirmedAt).toBeInstanceOf(Date);
    expect(stored.landlineApprovedAt).toBeNull();
    await dealer.agent
      .patch('/v1/dealer')
      .send({ contact: { landline: '' } })
      .expect(200);
    stored = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(stored.landline).toBeNull();
    expect(stored.landlineConfirmedAt).toBeNull();
    await h.prisma.dealer.update({
      where: { id: dealer.dealerId },
      data: { status: 'PENDING_APPROVAL' },
    });
    const refused = await dealer.agent
      .patch('/v1/dealer')
      .send({ contact: { landline: '9840012345' } })
      .expect(409);
    expect(refused.body.code).toBe('PROFILE_LOCKED');
  });

  it('keeps the approved number while pending, rejected or withdrawn, and supports removal', async () => {
    const dealer = await approvedDealer();
    const listing = await car(dealer);
    const change = await propose(dealer, '9840012345');
    expect((await reveal(buyer.agent, listing.slug).expect(200)).body.phone).toBe('+914162248890');
    await reviewer
      .post(`/v1/admin/profile-changes/${change}/reject`)
      .send({ reason: 'Please confirm dealership ownership of this number.' })
      .expect(200);
    expect((await reveal(buyer.agent, listing.slug).expect(200)).body.phone).toBe('+914162248890');
    await propose(dealer, '9840012345');
    await dealer.agent.delete('/v1/dealer/profile-change').expect(200);
    expect((await reveal(buyer.agent, listing.slug).expect(200)).body.phone).toBe('+914162248890');
    await approve(await propose(dealer, '9840012345'));
    expect((await reveal(buyer.agent, listing.slug).expect(200)).body.phone).toBe('+919840012345');
    const removal = await propose(dealer, null);
    expect((await reveal(buyer.agent, listing.slug).expect(200)).body.phone).toBe('+919840012345');
    await approve(removal);
    await reveal(buyer.agent, listing.slug).expect(404);
    expect(
      (await h.agent().get(`/v1/vehicles/${listing.slug}`).expect(200)).body.dealer.canCall,
    ).toBe(false);
  });

  it('enforces roles, strict inputs, availability and own-dealership restrictions', async () => {
    const dealer = await approvedDealer();
    const listing = await car(dealer);
    const manager = await fixtures.member(dealer, 'MANAGER');
    await manager.agent
      .patch('/v1/dealer')
      .send({ contact: { landline: '9840012345' } })
      .expect(403);
    await dealer.agent
      .patch('/v1/dealer')
      .send({ contact: { landline: 'not a number' } })
      .expect(400);
    await dealer.agent
      .patch('/v1/dealer')
      .send({ contact: { phone: '9840012345' } })
      .expect(400);
    await buyer.agent
      .post(`/v1/vehicles/${listing.slug}/reveal-contact`)
      .send({ dealerId: dealer.dealerId })
      .expect(400);
    await reveal(dealer.agent, listing.slug).expect(422);
    await h.prisma.listing.update({ where: { id: listing.id }, data: { status: 'RESERVED' } });
    await reveal(buyer.agent, listing.slug).expect(409);
    await h.prisma.listing.update({ where: { id: listing.id }, data: { status: 'ACTIVE' } });
    await h.prisma.dealer.update({ where: { id: dealer.dealerId }, data: { status: 'SUSPENDED' } });
    await reveal(buyer.agent, listing.slug).expect(409);
  });

  it('serialises competing profile proposals into one pending request', async () => {
    const dealer = await fixtures.dealership();
    const responses = await Promise.all(
      ['9840012345', '0416 224 8890'].map((landline) =>
        dealer.agent.patch('/v1/dealer').send({ contact: { landline } }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(
      await h.prisma.dealerProfileChange.count({
        where: { dealerId: dealer.dealerId, status: 'PENDING' },
      }),
    ).toBe(1);
  });

  it('limits repeated reveals by authenticated customer', async () => {
    const dealer = await approvedDealer();
    const visitor = await fixtures.dealership();
    const listing = await car(dealer);
    rateLimitState.enabled = true;
    try {
      for (let i = 0; i < 10; i += 1) await reveal(visitor.agent, listing.slug).expect(200);
      const response = await reveal(visitor.agent, listing.slug).expect(429);
      expect(response.body.code).toBe('CONTACT_RATE_LIMITED');
    } finally {
      rateLimitState.enabled = false;
    }
  });
});

describe('measured enquiry response time', () => {
  it('requires five valid samples and updates when dealers contact, close or mark spam, and a closed enquiry stays closed', async () => {
    const dealer = await fixtures.dealership();
    const listing = await car(dealer);
    const now = new Date();
    const createdAt = new Date(now.getTime() - 86_400_000);
    const enquiries = await Promise.all(
      [10, 20, 30, 40].map((minutes) =>
        h.prisma.enquiry.create({
          data: {
            dealerId: dealer.dealerId,
            listingId: listing.id,
            customerId: buyer.userId,
            status: 'CONTACTED',
            createdAt,
            contactedAt: new Date(createdAt.getTime() + minutes * 60_000),
          },
        }),
      ),
    );
    const fifth = await h.prisma.enquiry.create({
      data: {
        dealerId: dealer.dealerId,
        listingId: listing.id,
        customerId: buyer.userId,
        createdAt,
      },
    });
    await withTransaction(h.prisma, (tx) => refreshDealerResponseTime(tx, dealer.dealerId, now));
    const median = async () =>
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } }))
        .medianResponseMins;
    expect(await median()).toBeNull();
    await dealer.agent
      .patch(`/v1/dealer/enquiries/${fifth.id}`)
      .send({ status: 'CONTACTED' })
      .expect(200);
    expect(await median()).toBe(30);
    const firstContact = (await h.prisma.enquiry.findUniqueOrThrow({ where: { id: fifth.id } }))
      .contactedAt;
    await dealer.agent
      .patch(`/v1/dealer/enquiries/${fifth.id}`)
      .send({ status: 'CLOSED' })
      .expect(200);
    await dealer.agent
      .patch(`/v1/dealer/enquiries/${fifth.id}`)
      .send({ status: 'NEW' })
      .expect(409);
    expect(
      (await h.prisma.enquiry.findUniqueOrThrow({ where: { id: fifth.id } })).contactedAt,
    ).toEqual(firstContact);
    expect(await median()).toBe(30);
    await dealer.agent
      .patch(`/v1/dealer/enquiries/${enquiries[0]!.id}`)
      .send({ status: 'SPAM' })
      .expect(200);
    expect(await median()).toBeNull();
    await refreshAllDealerResponseTimes(h.prisma);
    expect(await median()).toBeNull();
  });

  it('retains both simultaneous first contacts in the dealer median', async () => {
    const dealer = await fixtures.dealership();
    const listing = await car(dealer);
    const createdAt = new Date(Date.now() - 86_400_000);
    for (const minutes of [10, 20, 30]) {
      await h.prisma.enquiry.create({
        data: {
          dealerId: dealer.dealerId,
          listingId: listing.id,
          customerId: buyer.userId,
          status: 'CONTACTED',
          createdAt,
          contactedAt: new Date(createdAt.getTime() + minutes * 60_000),
        },
      });
    }
    const pending = await Promise.all(
      [1, 2].map(() =>
        h.prisma.enquiry.create({
          data: {
            dealerId: dealer.dealerId,
            listingId: listing.id,
            customerId: buyer.userId,
            createdAt,
          },
        }),
      ),
    );
    const responses = await Promise.all(
      pending.map((enquiry) =>
        dealer.agent.patch(`/v1/dealer/enquiries/${enquiry.id}`).send({ status: 'CONTACTED' }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } }))
        .medianResponseMins,
    ).toBe(30);
  });

  it('ignores old, spam, missing and invalid timestamps and expires rolling samples', async () => {
    const dealer = await fixtures.dealership();
    const listing = await car(dealer);
    const now = new Date();
    const day = 86_400_000;
    const createdAt = new Date(now.getTime() - day);
    for (const minutes of [1, 2, 10, 20, 30, 60]) {
      await h.prisma.enquiry.create({
        data: {
          dealerId: dealer.dealerId,
          listingId: listing.id,
          customerId: buyer.userId,
          status: 'CLOSED',
          createdAt,
          contactedAt: new Date(createdAt.getTime() + minutes * 60_000),
        },
      });
    }
    await h.prisma.enquiry.createMany({
      data: [
        {
          dealerId: dealer.dealerId,
          listingId: listing.id,
          customerId: buyer.userId,
          status: 'SPAM',
          createdAt,
          contactedAt: new Date(createdAt.getTime() + 1000),
        },
        {
          dealerId: dealer.dealerId,
          listingId: listing.id,
          customerId: buyer.userId,
          status: 'CLOSED',
          createdAt,
        },
        {
          dealerId: dealer.dealerId,
          listingId: listing.id,
          customerId: buyer.userId,
          status: 'CONTACTED',
          createdAt: new Date(now.getTime() - 91 * day),
          contactedAt: now,
        },
        {
          dealerId: dealer.dealerId,
          listingId: listing.id,
          customerId: buyer.userId,
          status: 'CONTACTED',
          createdAt,
          contactedAt: new Date(createdAt.getTime() - 1000),
        },
      ],
    });
    await withTransaction(h.prisma, (tx) => refreshDealerResponseTime(tx, dealer.dealerId, now));
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } }))
        .medianResponseMins,
    ).toBe(15);
    await withTransaction(h.prisma, (tx) =>
      refreshDealerResponseTime(tx, dealer.dealerId, new Date(now.getTime() + 91 * day)),
    );
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } }))
        .medianResponseMins,
    ).toBeNull();
  });
});
