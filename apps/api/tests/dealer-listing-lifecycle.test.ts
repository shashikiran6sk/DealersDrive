import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R69 — the lifecycle a dealership drives once a car has been live: reserve,
 * mark sold and withdraw, each through its own route and each through
 * `transition()`. Putting a reserved or withdrawn car back on sale is an admin
 * decision; `listing-reactivation.test.ts` covers that request and review.
 *
 * The car is taken live the way approval leaves it (ACTIVE, a slug, a
 * publication date, a claimed registration) by writing the row directly:
 * approval has its own suite, and what matters here is everything after it.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let a: Dealership;
let b: Dealership;

let plate = 4000;
function nextPlate(): string {
  plate += 1;
  return `TN 31 LC ${String(plate)}`;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'lifecycle');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

async function liveCar(owner: Dealership = a, registrationNumber = nextPlate()) {
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber })
    .expect(201);
  const id = created.body.id as string;
  await owner.agent.patch(`/v1/dealer/vehicles/${id}`).send(COMPLETE_VEHICLE).expect(200);
  await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
  const publishedAt = new Date('2026-09-20T10:00:00Z');
  await h.prisma.listing.update({
    where: { vehicleId: id },
    data: { status: 'ACTIVE', slug: `lifecycle-${id}`, publishedAt },
  });
  return { id, publishedAt, slug: `lifecycle-${id}` };
}

function post(owner: Dealership, id: string, action: string, body?: object) {
  const req = owner.agent.post(`/v1/dealer/vehicles/${id}/${action}`);
  return body ? req.send(body) : req;
}

async function stored(id: string) {
  const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
  const vehicle = await h.prisma.vehicle.findUniqueOrThrow({ where: { id } });
  return { listing, vehicle };
}

async function trail(listingId: string) {
  const rows = await h.prisma.auditLog.findMany({
    where: { entityType: 'Listing', entityId: listingId },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => row.action);
}

describe('reserving', () => {
  it('moves ACTIVE to RESERVED, stamps it, audits it and offers the reserved moves', async () => {
    const { id } = await liveCar();
    const res = await post(a, id, 'reserve').expect(200);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.listing).toMatchObject({
      status: 'RESERVED',
      statusLabel: 'Reserved',
      statusTone: 'warn',
      actions: ['markSold', 'requestReactivation'],
      reactivation: null,
      withdrawal: null,
      canEdit: false,
    });
    expect(res.body.listing.reservedAt).toEqual(expect.any(String));

    const { listing, vehicle } = await stored(id);
    expect(listing.status).toBe('RESERVED');
    expect(vehicle.releasedAt).toBeNull();
    expect(await trail(listing.id)).toContain('listing.reserved');
  });

  it('has no direct way back on sale for the dealership: the old routes are gone', async () => {
    const { id } = await liveCar();
    await post(a, id, 'reserve').expect(200);
    await post(a, id, 'reactivate').expect(404);
    expect((await stored(id)).listing.status).toBe('RESERVED');
  });

  it('refuses to reserve a reserved car', async () => {
    const { id } = await liveCar();
    await post(a, id, 'reserve').expect(200);
    const again = await post(a, id, 'reserve').expect(409);
    expect(again.body).toMatchObject({
      code: 'LISTING_NOT_RESERVABLE',
      listingStatus: 'RESERVED',
    });
  });
});

describe('marking sold', () => {
  it.each(['ACTIVE', 'RESERVED'] as const)(
    'sells a %s car, releases the registration and keeps the record',
    async (from) => {
      const { id } = await liveCar();
      if (from === 'RESERVED') await post(a, id, 'reserve').expect(200);

      const res = await post(a, id, 'mark-sold').expect(200);
      expect(res.body.listing).toMatchObject({ status: 'SOLD', statusLabel: 'Sold', actions: [] });
      expect(res.body.listing.soldAt).toEqual(expect.any(String));

      const { listing, vehicle } = await stored(id);
      expect(listing.status).toBe('SOLD');
      expect(vehicle.releasedAt).toBeInstanceOf(Date);
      expect(await trail(listing.id)).toContain('listing.marked_sold');
    },
  );

  it('never goes back: every move out of SOLD is refused and the car stays sold', async () => {
    const { id } = await liveCar();
    await post(a, id, 'mark-sold').expect(200);

    const refusals: [string, string][] = [
      ['reserve', 'LISTING_NOT_RESERVABLE'],
      ['mark-sold', 'LISTING_NOT_SELLABLE'],
    ];
    for (const [action, code] of refusals) {
      const res = await post(a, id, action).expect(409);
      expect(res.body.code, action).toBe(code);
    }
    await post(a, id, 'withdraw', { reason: 'OTHER' }).expect(409, /LISTING_NOT_WITHDRAWABLE/);
    await post(a, id, 'request-reactivation', {}).expect(409, /LISTING_NOT_REACTIVATABLE/);
    expect((await stored(id)).listing.status).toBe('SOLD');
  });

  it('keeps every enquiry the car had', async () => {
    const { id } = await liveCar();
    const { listing } = await stored(id);
    const customer = await h.prisma.user.create({
      data: { email: `lifecycle-buyer-${id}@example.com`, fullName: 'Buyer' },
    });
    await h.prisma.enquiry.create({
      data: { customerId: customer.id, dealerId: a.dealerId, listingId: listing.id },
    });

    await post(a, id, 'mark-sold').expect(200);
    await expect(h.prisma.enquiry.count({ where: { listingId: listing.id } })).resolves.toBe(1);
  });
});

describe('withdrawing', () => {
  it('withdraws with a reason and a note the dealership sees, and keeps the registration', async () => {
    const registrationNumber = nextPlate();
    const { id } = await liveCar(a, registrationNumber);

    const res = await post(a, id, 'withdraw', {
      reason: 'DOCUMENT_ISSUE',
      note: '  RC is with the bank. ',
    }).expect(200);
    expect(res.body.listing).toMatchObject({
      status: 'WITHDRAWN',
      statusLabel: 'Withdrawn',
      actions: ['requestReactivation'],
      withdrawal: {
        reason: 'DOCUMENT_ISSUE',
        reasonLabel: 'Issue with the documents',
        note: 'RC is with the bank.',
      },
    });

    const { listing, vehicle } = await stored(id);
    expect(listing).toMatchObject({
      status: 'WITHDRAWN',
      withdrawalReason: 'DOCUMENT_ISSUE',
      withdrawalNote: 'RC is with the bank.',
    });
    expect(listing.withdrawnAt).toBeInstanceOf(Date);
    expect(vehicle.releasedAt).toBeNull();

    const duplicate = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber })
      .expect(409);
    expect(duplicate.body.code).toBe('DUPLICATE_REGISTRATION');
  });

  it('does not withdraw a reserved car: it can only be sold or asked back on sale', async () => {
    const { id } = await liveCar();
    await post(a, id, 'reserve').expect(200);
    await post(a, id, 'withdraw', { reason: 'TEMPORARILY_PAUSED' }).expect(
      409,
      /LISTING_NOT_WITHDRAWABLE/,
    );
    expect((await stored(id)).listing.status).toBe('RESERVED');
  });

  it('has no direct relist for the dealership', async () => {
    const { id } = await liveCar();
    await post(a, id, 'withdraw', { reason: 'OTHER' }).expect(200);
    await post(a, id, 'relist').expect(404);
    expect((await stored(id)).listing.status).toBe('WITHDRAWN');
  });
});

describe('what a withdrawal accepts', () => {
  it.each([
    ['no body', undefined],
    ['no reason', { note: 'Paused.' }],
    ['an unknown reason', { reason: 'BORED' }],
    ['a note that is too long', { reason: 'OTHER', note: 'x'.repeat(501) }],
    ['a status', { reason: 'OTHER', status: 'ACTIVE' }],
    ['a dealer id', { reason: 'OTHER', dealerId: '00000000-0000-4000-8000-000000000001' }],
  ])('refuses %s with a 400', async (_label, body) => {
    const { id } = await liveCar();
    await post(a, id, 'withdraw', body).expect(400);
    expect((await stored(id)).listing.status).toBe('ACTIVE');
  });

  it('takes no body on the other moves', async () => {
    const { id } = await liveCar();
    await post(a, id, 'reserve', { status: 'SOLD' }).expect(200);
    expect((await stored(id)).listing.status).toBe('RESERVED');
  });
});

describe('whose car it is', () => {
  it('answers another dealership’s car with a 404 and moves nothing', async () => {
    const { id } = await liveCar(a);
    for (const action of ['reserve', 'mark-sold']) {
      await post(b, id, action).expect(404);
    }
    await post(b, id, 'withdraw', { reason: 'OTHER' }).expect(404);
    await post(a, id, 'reserve').expect(200);
    await post(b, id, 'request-reactivation', {}).expect(404);
    await expect(
      h.prisma.listingReactivationRequest.count({ where: { listing: { vehicleId: id } } }),
    ).resolves.toBe(0);
    expect((await stored(id)).listing.status).toBe('RESERVED');
    await post(a, id, 'mark-sold').expect(200);
    expect((await stored(id)).listing.status).toBe('SOLD');
  });

  it('refuses the signed-out', async () => {
    const { id } = await liveCar();
    await h.agent().post(`/v1/dealer/vehicles/${id}/reserve`).expect(401);
  });

  it('refuses a draft or a car still in review', async () => {
    const created = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: nextPlate() })
      .expect(201);
    await post(a, created.body.id, 'reserve').expect(409, /LISTING_NOT_RESERVABLE/);
    await post(a, created.body.id, 'mark-sold').expect(409, /LISTING_NOT_SELLABLE/);
  });
});

describe('two moves at once', () => {
  it('lands exactly one of a reservation and a sale racing on one car', async () => {
    const { id } = await liveCar();
    const [reserve, sell] = await Promise.all([post(a, id, 'reserve'), post(a, id, 'mark-sold')]);
    const statuses = [reserve.status, sell.status].sort();
    expect(statuses[0]).toBe(200);

    const { listing } = await stored(id);
    const moves = (await trail(listing.id)).filter((action) =>
      ['listing.reserved', 'listing.marked_sold'].includes(action),
    );
    if (statuses[1] === 409) {
      expect(moves).toHaveLength(1);
    } else {
      expect(listing.status).toBe('SOLD');
      expect(moves).toEqual(['listing.reserved', 'listing.marked_sold']);
    }
  });
});
