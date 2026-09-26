import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The admin moderation queue (**F069**, as revised by **R45**).
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let b: Dealership;
const submitted: string[] = [];

async function submittedVehicle(owner: Dealership, plate: string, fields = COMPLETE_VEHICLE) {
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: plate })
    .expect(201);
  await owner.agent.patch(`/v1/dealer/vehicles/${created.body.id}`).send(fields).expect(200);
  await owner.agent.post(`/v1/dealer/vehicles/${created.body.id}/submit`).expect(200);
  return created.body.id as string;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'queue');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();

  submitted.push(await submittedVehicle(a, 'MH 12 QU 0001'));
  submitted.push(
    await submittedVehicle(b, 'MH 12 QU 0002', {
      ...COMPLETE_VEHICLE,
      make: 'Tata',
      model: 'Nexon',
    }),
  );
  submitted.push(await submittedVehicle(a, 'MH 12 QU 0003'));
  await a.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: 'MH 12 QU 0004' })
    .expect(201);
});

afterAll(async () => {
  await h.close();
});

describe('the review queue', () => {
  it('lists what is waiting, oldest submission first, with who, where and since when', async () => {
    const { body } = await admin.get('/v1/admin/listings').expect(200);
    const mine = body.data.filter((row: { vehicleId: string }) =>
      submitted.includes(row.vehicleId),
    );

    expect(body.status).toBe('PENDING_REVIEW');
    expect(mine.map((row: { registrationDisplay: string }) => row.registrationDisplay)).toEqual([
      'MH 12 QU 0001',
      'MH 12 QU 0002',
      'MH 12 QU 0003',
    ]);
    expect(mine[1]).toMatchObject({
      title: '2023 Tata Nexon SX(O)',
      priceLabel: '₹14,50,000',
      statusLabel: 'Pending review',
      dealer: { id: b.dealerId },
      location: 'Katpadi, Vellore',
      resubmission: false,
    });
    expect(mine[1].waitingLabel).toEqual(expect.any(String));
    expect(body.counts.PENDING_REVIEW).toBeGreaterThanOrEqual(3);
  });

  it('never shows a draft to a moderator', async () => {
    const { body } = await admin.get('/v1/admin/listings').expect(200);
    expect(
      body.data.some(
        (row: { registrationDisplay: string }) => row.registrationDisplay === 'MH 12 QU 0004',
      ),
    ).toBe(false);
  });

  it('searches by plate and by dealership', async () => {
    const byPlate = await admin.get('/v1/admin/listings?q=mh-12-qu-0002').expect(200);
    expect(byPlate.body.data).toHaveLength(1);

    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: a.dealerId } });
    const byDealer = await admin
      .get(`/v1/admin/listings?q=${encodeURIComponent(dealer.brandName)}`)
      .expect(200);
    expect(byDealer.body.data.map((row: { dealer: { id: string } }) => row.dealer.id)).toEqual([
      a.dealerId,
      a.dealerId,
    ]);
  });

  it('marks a resubmission', async () => {
    const id = submitted[2]!;
    await h.prisma.listing.update({
      where: { vehicleId: id },
      data: { status: 'CHANGES_REQUESTED' },
    });
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);

    const { body } = await admin.get('/v1/admin/listings?q=MH12QU0003').expect(200);
    expect(body.data[0]).toMatchObject({ resubmission: true });
  });

  it('lists another status on request', async () => {
    const { body } = await admin.get('/v1/admin/listings?status=DRAFT&q=MH12QU0004').expect(200);
    expect(body.status).toBe('DRAFT');
    expect(body.data).toHaveLength(1);
  });

  it('pages oldest first with a cursor', async () => {
    const first = await admin.get('/v1/admin/listings?limit=1&q=MH12QU').expect(200);
    const second = await admin
      .get(`/v1/admin/listings?limit=1&q=MH12QU&cursor=${first.body.page.nextCursor}`)
      .expect(200);
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
  });
});

describe('who may see the queue', () => {
  it('refuses a dealer session outright', async () => {
    await a.agent.get('/v1/admin/listings').expect(401);
  });

  it('refuses no session', async () => {
    await h.agent().get('/v1/admin/listings').expect(401);
  });

  it('refuses an admin without the moderation permission', async () => {
    const email = env.adminAllowlist[0] ?? '';
    await h.prisma.user.updateMany({ where: { email }, data: { adminRole: 'SUPPORT' } });
    try {
      const refused = await admin.get('/v1/admin/listings').expect(403);
      expect(refused.body.detail).toContain('admin:listing:moderate');
    } finally {
      await h.prisma.user.updateMany({ where: { email }, data: { adminRole: 'SUPER_ADMIN' } });
    }
  });
});

describe('the operations overview counts the same queue', () => {
  it('reports the waiting listings and the badge', async () => {
    const { body } = await admin.get('/v1/admin/metrics/overview').expect(200);
    expect(body.moderationQueue.pendingCount).toBeGreaterThanOrEqual(3);
    expect(body.headerBadge.tone).toBe('warn');
  });
});
