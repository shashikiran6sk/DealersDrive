import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The dealer's inventory and the dashboard's listing counts (**F066**).
 */
let h: AuthHarness;
let a: Dealership;
let b: Dealership;

async function vehicle(owner: Dealership, plate: string, status?: string, fields = {}) {
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: plate })
    .expect(201);
  if (Object.keys(fields).length > 0) {
    await owner.agent.patch(`/v1/dealer/vehicles/${created.body.id}`).send(fields).expect(200);
  }
  if (status) {
    await h.prisma.listing.update({
      where: { vehicleId: created.body.id },
      data: { status: status as never },
    });
  }
  return created.body.id as string;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'inventory');
  a = await fixtures.dealership();
  b = await fixtures.dealership();

  await vehicle(a, 'KA 51 IN 0001', undefined, { make: 'Hyundai', model: 'Creta' });
  await vehicle(a, 'KA 51 IN 0002', 'PENDING_REVIEW', { make: 'Tata', model: 'Nexon' });
  await vehicle(a, 'KA 51 IN 0003', 'CHANGES_REQUESTED', { make: 'Maruti Suzuki', model: 'Swift' });
  await vehicle(a, 'KA 51 IN 0004', 'ACTIVE', { make: 'Hyundai', model: 'i20' });
  await vehicle(a, 'KA 51 IN 0005', 'ACTIVE');
  await vehicle(a, 'KA 51 IN 0006', 'SOLD');
  await vehicle(b, 'TN 22 OT 0001', 'ACTIVE', { make: 'Hyundai', model: 'Creta' });
});

afterAll(async () => {
  await h.close();
});

describe('the inventory', () => {
  it('lists the dealership’s own vehicles, newest first, with counts per status', async () => {
    const { body } = await a.agent.get('/v1/dealer/vehicles').expect(200);

    expect(
      body.data.map((row: { registrationDisplay: string }) => row.registrationDisplay),
    ).toEqual([
      'KA 51 IN 0006',
      'KA 51 IN 0005',
      'KA 51 IN 0004',
      'KA 51 IN 0003',
      'KA 51 IN 0002',
      'KA 51 IN 0001',
    ]);
    expect(body.counts).toEqual({
      ALL: 6,
      DRAFT: 1,
      PENDING_REVIEW: 1,
      CHANGES_REQUESTED: 1,
      ACTIVE: 2,
      SOLD: 1,
    });
    expect(body.data[2]).toMatchObject({
      title: 'Hyundai i20',
      status: 'ACTIVE',
      statusLabel: 'Active',
      statusTone: 'ok',
    });
  });

  it('filters to one status without changing the counts', async () => {
    const { body } = await a.agent.get('/v1/dealer/vehicles?status=ACTIVE').expect(200);
    expect(body.data).toHaveLength(2);
    expect(body.counts.ALL).toBe(6);
  });

  it('finds a car by plate however the plate is typed, or by make and model', async () => {
    const byPlate = await a.agent.get('/v1/dealer/vehicles?q=ka-51-in-0003').expect(200);
    expect(byPlate.body.data.map((row: { title: string }) => row.title)).toEqual([
      'Maruti Suzuki Swift',
    ]);

    const byMake = await a.agent.get('/v1/dealer/vehicles?q=hyundai').expect(200);
    expect(byMake.body.data).toHaveLength(2);
  });

  it('pages with a cursor', async () => {
    const first = await a.agent.get('/v1/dealer/vehicles?limit=4').expect(200);
    expect(first.body.data).toHaveLength(4);
    expect(first.body.page.hasMore).toBe(true);

    const second = await a.agent
      .get(`/v1/dealer/vehicles?limit=4&cursor=${first.body.page.nextCursor}`)
      .expect(200);
    expect(second.body.data).toHaveLength(2);
    expect(second.body.page).toEqual({ nextCursor: null, hasMore: false });
  });

  it('never shows one dealership another’s cars', async () => {
    const { body } = await b.agent.get('/v1/dealer/vehicles').expect(200);
    expect(body.counts).toEqual({ ALL: 1, ACTIVE: 1 });
    expect(
      body.data.map((row: { registrationDisplay: string }) => row.registrationDisplay),
    ).toEqual(['TN 22 OT 0001']);
  });

  it('refuses an unknown status or an unknown parameter by name', async () => {
    await a.agent.get('/v1/dealer/vehicles?status=APPROVED').expect(400);
    const refused = await a.agent.get(`/v1/dealer/vehicles?dealerId=${b.dealerId}`).expect(400);
    expect(JSON.stringify(refused.body)).toContain('dealerId');
  });

  it('needs a session', async () => {
    await h.agent().get('/v1/dealer/vehicles').expect(401);
  });
});

describe('the dashboard counts the same listings', () => {
  it('reports Active, Reserved, Pending review, Changes requested and Sold, and flags the changes', async () => {
    const { body } = await a.agent.get('/v1/dealer/dashboard').expect(200);

    expect(
      body.listingStats.map((stat: { key: string; value: number }) => [stat.key, stat.value]),
    ).toEqual([
      ['ACTIVE', 2],
      ['RESERVED', 0],
      ['PENDING_REVIEW', 1],
      ['CHANGES_REQUESTED', 1],
      ['SOLD', 1],
    ]);
    expect(body.alerts[0]).toMatchObject({
      type: 'CHANGES_REQUESTED',
      href: '/dealer/inventory?status=CHANGES_REQUESTED',
    });
  });
});
