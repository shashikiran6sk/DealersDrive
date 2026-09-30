import type {
  AdminReactivationRow,
  AdminReactivationsResponse,
  DealerInventoryResponse,
  PublicVehiclesResponse,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * A reserved or withdrawn car goes back on sale only on an admin's approval.
 *
 * The dealership files a reactivation request; an admin approves it (the
 * listing goes ACTIVE through the state machine, in the same transaction) or
 * rejects it (the listing does not move). Every car here is taken live through
 * the real approval flow, so what the public sees afterwards is what a real
 * reactivation leaves behind.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let b: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let plate = 100;

function nextPlate(): string {
  plate += 1;
  return `TN 45 RA ${String(plate).padStart(4, '0')}`;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'reactivation');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);
});

afterAll(async () => {
  await h.close();
});

function move(owner: Dealership, car: Published, action: string, body?: object) {
  const req = owner.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/${action}`);
  return body ? req.send(body) : req;
}

async function reserved(): Promise<Published> {
  const car = await kit.published(a, nextPlate());
  await move(a, car, 'reserve').expect(200);
  return car;
}

async function withdrawn(): Promise<Published> {
  const car = await kit.published(a, nextPlate());
  await move(a, car, 'withdraw', { reason: 'TEMPORARILY_PAUSED', note: 'Service.' }).expect(200);
  return car;
}

async function requestFor(car: Published, reason?: string): Promise<string> {
  const res = await move(a, car, 'request-reactivation', reason ? { reason } : {}).expect(200);
  return res.body.listing.reactivation.id as string;
}

function decide(
  agent: request.Agent,
  requestId: string,
  decision: 'approve' | 'reject',
  note?: string,
) {
  return agent
    .post(`/v1/admin/reactivation-requests/${requestId}/${decision}`)
    .send(note ? { note } : {});
}

async function listingOf(car: Published) {
  return h.prisma.listing.findUniqueOrThrow({ where: { id: car.listingId } });
}

async function requestRow(id: string) {
  return h.prisma.listingReactivationRequest.findUniqueOrThrow({ where: { id } });
}

async function trail(car: Published): Promise<string[]> {
  const rows = await h.prisma.auditLog.findMany({
    where: { entityType: 'Listing', entityId: car.listingId },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => row.action);
}

async function onMarketplace(car: Published): Promise<string | null> {
  const { body } = await h.agent().get(`/v1/dealers/${a.slug}/vehicles?limit=48`).expect(200);
  const card = (body as PublicVehiclesResponse).data.find((entry) => entry.slug === car.slug);
  return card?.availability ?? null;
}

describe('the dealer asks', () => {
  it('files a request on a reserved car without moving it, and offers only the sale meanwhile', async () => {
    const car = await reserved();
    const res = await move(a, car, 'request-reactivation', {
      reason: '  The buyer backed out.  ',
    }).expect(200);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.listing).toMatchObject({
      status: 'RESERVED',
      actions: ['markSold'],
      reactivation: {
        status: 'PENDING',
        statusLabel: 'Reactivation pending approval',
        fromStatus: 'RESERVED',
        reason: 'The buyer backed out.',
        reviewedAt: null,
        adminNote: null,
      },
    });

    const stored = await requestRow(res.body.listing.reactivation.id);
    expect(stored).toMatchObject({
      listingId: car.listingId,
      dealerId: a.dealerId,
      fromStatus: 'RESERVED',
      status: 'PENDING',
      requestedBy: a.userId,
    });
    expect((await listingOf(car)).status).toBe('RESERVED');
    expect(await trail(car)).toContain('listing.reactivation_requested');
  });

  it('files a request on a withdrawn car, which then offers nothing more', async () => {
    const car = await withdrawn();
    const res = await move(a, car, 'request-reactivation', {}).expect(200);
    expect(res.body.listing).toMatchObject({
      status: 'WITHDRAWN',
      actions: [],
      reactivation: { status: 'PENDING', fromStatus: 'WITHDRAWN', reason: null },
    });
  });

  it('shows the pending state on the inventory row', async () => {
    const car = await reserved();
    await requestFor(car);
    const { body } = await a.agent.get('/v1/dealer/vehicles?status=RESERVED&limit=100').expect(200);
    const row = (body as DealerInventoryResponse).data.find((entry) => entry.id === car.vehicleId);
    expect(row).toMatchObject({ reactivationPending: true, actions: ['markSold'] });
  });

  it('refuses a second request while one is waiting, and keeps one row', async () => {
    const car = await reserved();
    await requestFor(car);
    const again = await move(a, car, 'request-reactivation', {}).expect(409);
    expect(again.body.code).toBe('REACTIVATION_ALREADY_PENDING');
    await expect(
      h.prisma.listingReactivationRequest.count({ where: { listingId: car.listingId } }),
    ).resolves.toBe(1);
  });

  it('lands exactly one of two requests fired at once (a double click)', async () => {
    const car = await withdrawn();
    const results = await Promise.all([
      move(a, car, 'request-reactivation', {}),
      move(a, car, 'request-reactivation', {}),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    await expect(
      h.prisma.listingReactivationRequest.count({
        where: { listingId: car.listingId, status: 'PENDING' },
      }),
    ).resolves.toBe(1);
  });

  it.each(['ACTIVE', 'SOLD'] as const)('refuses a request on a %s car', async (status) => {
    const car = await kit.published(a, nextPlate());
    if (status === 'SOLD') await move(a, car, 'mark-sold').expect(200);
    const res = await move(a, car, 'request-reactivation', {}).expect(409);
    expect(res.body).toMatchObject({ code: 'LISTING_NOT_REACTIVATABLE', listingStatus: status });
    expect((await listingOf(car)).status).toBe(status);
  });

  it.each([
    ['no body', undefined],
    ['a reason that is too long', { reason: 'x'.repeat(501) }],
    ['a status', { status: 'ACTIVE' }],
    ['a dealer id', { dealerId: '00000000-0000-4000-8000-000000000001' }],
  ])('refuses %s with a 400', async (_label, body) => {
    const car = await reserved();
    await move(a, car, 'request-reactivation', body).expect(400);
    await expect(
      h.prisma.listingReactivationRequest.count({ where: { listingId: car.listingId } }),
    ).resolves.toBe(0);
  });

  it('answers another dealership’s car with a 404 and files nothing', async () => {
    const car = await reserved();
    await move(b, car, 'request-reactivation', {}).expect(404);
    await expect(
      h.prisma.listingReactivationRequest.count({ where: { listingId: car.listingId } }),
    ).resolves.toBe(0);
  });
});

describe('the admin queue', () => {
  it('lists pending requests oldest first, with the car, the dealer and the move asked for', async () => {
    const car = await reserved();
    const id = await requestFor(car, 'Buyer walked away.');

    const { body } = await admin.get('/v1/admin/reactivation-requests?limit=100').expect(200);
    const response = body as AdminReactivationsResponse;
    expect(response.status).toBe('PENDING');
    const row = response.data.find((entry) => entry.id === id);
    expect(row).toMatchObject({
      status: 'PENDING',
      fromStatus: 'RESERVED',
      fromStatusLabel: 'Reserved',
      toStatus: 'ACTIVE',
      reason: 'Buyer walked away.',
      current: true,
      listing: { id: car.listingId, vehicleId: car.vehicleId, status: 'RESERVED', slug: car.slug },
      dealer: { id: a.dealerId, slug: a.slug },
    } satisfies Partial<Record<keyof AdminReactivationRow, unknown>>);
    const times = response.data.map((entry) => entry.requestedAt);
    expect([...times].sort()).toEqual(times);
    expect(response.counts.PENDING).toBeGreaterThanOrEqual(1);

    const listings = await admin.get('/v1/admin/listings').expect(200);
    expect(listings.body.reactivationPending).toBe(response.counts.PENDING);
  });

  it('refuses an unknown filter', async () => {
    await admin.get('/v1/admin/reactivation-requests?status=MAYBE').expect(400);
    await admin.get('/v1/admin/reactivation-requests?dealerId=x').expect(400);
  });
});

describe('approval', () => {
  it('puts a reserved car back on sale, and back on every public surface', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    expect(await onMarketplace(car)).toBe('RESERVED');

    const res = await decide(admin, id, 'approve', 'Checked with the dealer.').expect(200);
    expect(res.body).toMatchObject({
      id,
      status: 'APPROVED',
      adminNote: 'Checked with the dealer.',
      listing: { status: 'ACTIVE' },
    });

    const listing = await listingOf(car);
    expect(listing).toMatchObject({ status: 'ACTIVE', reservedAt: null });
    expect(await requestRow(id)).toMatchObject({
      status: 'APPROVED',
      reviewedAt: expect.any(Date),
    });
    expect(await trail(car)).toEqual(
      expect.arrayContaining([
        'listing.reserved',
        'listing.reactivation_requested',
        'listing.reactivated',
        'listing.reactivation_approved',
      ]),
    );
    expect(await onMarketplace(car)).toBe('AVAILABLE');
    await h.agent().get(`/v1/vehicles/${car.slug}`).expect(200);

    const dealerView = await a.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(200);
    expect(dealerView.body.listing).toMatchObject({
      status: 'ACTIVE',
      actions: ['reserve', 'markSold', 'withdraw'],
      reactivation: null,
    });
  });

  it('puts a withdrawn car back on sale, clearing the withdrawal and keeping the slug', async () => {
    const car = await withdrawn();
    expect(await onMarketplace(car)).toBeNull();
    const before = await listingOf(car);
    const id = await requestFor(car);

    await decide(admin, id, 'approve').expect(200);
    const listing = await listingOf(car);
    expect(listing).toMatchObject({
      status: 'ACTIVE',
      slug: car.slug,
      publishedAt: before.publishedAt,
      withdrawnAt: null,
      withdrawalReason: null,
      withdrawalNote: null,
    });
    expect(await trail(car)).toEqual(expect.arrayContaining(['listing.relisted']));
    expect(await onMarketplace(car)).toBe('AVAILABLE');
  });

  it('reclaims a registration a pre-R69 withdrawal released', async () => {
    const car = await withdrawn();
    await h.prisma.vehicle.update({
      where: { id: car.vehicleId },
      data: { releasedAt: new Date() },
    });
    await decide(admin, await requestFor(car), 'approve').expect(200);
    const vehicle = await h.prisma.vehicle.findUniqueOrThrow({ where: { id: car.vehicleId } });
    expect(vehicle.releasedAt).toBeNull();
  });

  it('refuses a car another dealership has claimed since, and moves nothing', async () => {
    const registrationNumber = nextPlate();
    const car = await kit.published(a, registrationNumber);
    await move(a, car, 'withdraw', { reason: 'NO_LONGER_FOR_SALE' }).expect(200);
    await h.prisma.vehicle.update({
      where: { id: car.vehicleId },
      data: { releasedAt: new Date() },
    });
    await kit.published(b, registrationNumber);

    const id = await requestFor(car);
    const res = await decide(admin, id, 'approve').expect(409);
    expect(res.body.code).toBe('DUPLICATE_REGISTRATION');
    expect((await listingOf(car)).status).toBe('WITHDRAWN');
    expect((await requestRow(id)).status).toBe('PENDING');
  });

  it('refuses to decide a request twice', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    await decide(admin, id, 'approve').expect(200);
    const again = await decide(admin, id, 'approve').expect(409);
    expect(again.body.code).toBe('REACTIVATION_NOT_PENDING');
    await decide(admin, id, 'reject').expect(409, /REACTIVATION_NOT_PENDING/);
    expect((await listingOf(car)).status).toBe('ACTIVE');
  });

  it('answers an unknown request with a 404', async () => {
    await decide(admin, '00000000-0000-4000-8000-00000000abcd', 'approve').expect(404);
  });
});

describe('rejection', () => {
  it('leaves the listing where it was and tells the dealer why; they may ask again', async () => {
    const car = await withdrawn();
    const id = await requestFor(car);

    const res = await decide(admin, id, 'reject', 'Documents still pending.').expect(200);
    expect(res.body).toMatchObject({ status: 'REJECTED', adminNote: 'Documents still pending.' });

    const listing = await listingOf(car);
    expect(listing).toMatchObject({ status: 'WITHDRAWN', withdrawalReason: 'TEMPORARILY_PAUSED' });
    expect(await onMarketplace(car)).toBeNull();
    expect(await trail(car)).toContain('listing.reactivation_rejected');
    expect(await trail(car)).not.toContain('listing.relisted');

    const dealerView = await a.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(200);
    expect(dealerView.body.listing).toMatchObject({
      status: 'WITHDRAWN',
      actions: ['requestReactivation'],
      reactivation: {
        status: 'REJECTED',
        statusLabel: 'Reactivation declined',
        adminNote: 'Documents still pending.',
      },
    });

    const decided = await admin.get('/v1/admin/reactivation-requests?status=REJECTED').expect(200);
    expect((decided.body as AdminReactivationsResponse).data.map((row) => row.id)).toContain(id);

    await requestFor(car);
  });

  it('keeps a reserved car reserved', async () => {
    const car = await reserved();
    await decide(admin, await requestFor(car), 'reject').expect(200);
    expect((await listingOf(car)).status).toBe('RESERVED');
    expect(await onMarketplace(car)).toBe('RESERVED');
  });
});

describe('a request the listing outran', () => {
  it('is closed when the reserved car is sold, and can never reactivate the sold car', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    await move(a, car, 'mark-sold').expect(200);
    expect(await requestRow(id)).toMatchObject({
      status: 'CANCELLED',
      reviewedAt: expect.any(Date),
    });

    const res = await decide(admin, id, 'approve').expect(409);
    expect(res.body.code).toBe('REACTIVATION_NOT_PENDING');
    expect((await listingOf(car)).status).toBe('SOLD');
    expect(await onMarketplace(car)).toBeNull();
  });

  it('is refused as stale if the listing moved without closing it', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    await h.prisma.listing.update({ where: { id: car.listingId }, data: { status: 'SOLD' } });

    const res = await decide(admin, id, 'approve').expect(409);
    expect(res.body).toMatchObject({ code: 'REACTIVATION_STALE', listingStatus: 'SOLD' });
    expect((await listingOf(car)).status).toBe('SOLD');
    expect((await requestRow(id)).status).toBe('PENDING');
  });

  it('never ends with a sold car on sale when a sale and an approval race', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    const [sale, approval] = await Promise.all([
      move(a, car, 'mark-sold'),
      decide(admin, id, 'approve'),
    ]);

    expect(sale.status).toBe(200);
    expect([200, 409]).toContain(approval.status);
    expect((await listingOf(car)).status).toBe('SOLD');
    const moves = (await trail(car)).filter((action) =>
      ['listing.reactivated', 'listing.marked_sold'].includes(action),
    );
    expect(moves[moves.length - 1]).toBe('listing.marked_sold');
    expect((await requestRow(id)).status).toBe(approval.status === 200 ? 'APPROVED' : 'CANCELLED');
  });
});

describe('who may decide', () => {
  it('refuses a dealer on the admin routes, even for their own request', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    const res = await decide(a.agent, id, 'approve');
    expect([401, 403]).toContain(res.status);
    await a.agent.get('/v1/admin/reactivation-requests').expect(res.status);
    expect((await listingOf(car)).status).toBe('RESERVED');
    expect((await requestRow(id)).status).toBe('PENDING');
  });

  it('refuses the signed-out', async () => {
    const car = await reserved();
    const id = await requestFor(car);
    await decide(h.agent(), id, 'approve').expect(401);
    await h
      .agent()
      .post(`/v1/dealer/vehicles/${car.vehicleId}/request-reactivation`)
      .send({})
      .expect(401);
  });
});
