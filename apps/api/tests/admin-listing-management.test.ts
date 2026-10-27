import { randomUUID } from 'node:crypto';

import { AdminListingDetail, ListingCheckKey } from '@dealers-drive/contracts';
import type { ListingStatus } from '@prisma/client';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

let h: AuthHarness;
let owner: Dealership;
let other: Dealership;
let admin: request.Agent;
let moderator: request.Agent;
let support: request.Agent;
let sales: request.Agent;
let plate = 2000;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'admin-listing-management');
  owner = await fixtures.dealership();
  other = await fixtures.dealership();
  admin = await fixtures.moderator();
  moderator = await fixtures.staff('MODERATOR');
  support = await fixtures.staff('SUPPORT');
  sales = await fixtures.staff('SALES_REP');
});
afterAll(async () => {
  await h.close();
});

async function candidate(status: ListingStatus = 'ACTIVE', dealer = owner) {
  plate += 1;
  const created = await dealer.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `TN22AM${plate}` })
    .expect(201);
  const vehicleId = String(created.body.id);
  await dealer.agent
    .patch(`/v1/dealer/vehicles/${vehicleId}`)
    .send({ ...COMPLETE_VEHICLE, insuranceType: 'NONE' })
    .expect(200);
  const submitted = await dealer.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
  const listingId = String(submitted.body.listing.id);
  await seedImages(h.prisma, { vehicleId, dealerId: dealer.dealerId }, 6);
  for (const key of ListingCheckKey.options)
    await admin
      .put(`/v1/admin/listings/${listingId}/checks/${key}`)
      .send({ checked: true })
      .expect(200);
  if (status !== 'PENDING_REVIEW' && status !== 'CHANGES_REQUESTED')
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
  if (status === 'RESERVED')
    await admin.post(`/v1/admin/listings/${listingId}/reserve`).expect(200);
  if (status === 'SOLD') await admin.post(`/v1/admin/listings/${listingId}/mark-sold`).expect(200);
  if (status === 'CHANGES_REQUESTED')
    await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Correct vehicle information.' })
      .expect(200);
  if (status === 'WITHDRAWN')
    await dealer.agent
      .post(`/v1/dealer/vehicles/${vehicleId}/withdraw`)
      .send({ reason: 'OTHER' })
      .expect(200);
  const response = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
  return { listingId, vehicleId, detail: AdminListingDetail.parse(response.body) };
}
function patch(c: Awaited<ReturnType<typeof candidate>>, details: object, agent = admin) {
  return agent
    .patch(`/v1/admin/listings/${c.listingId}/vehicle`)
    .send({ details, expectedUpdatedAt: c.detail.vehicle.updatedAt });
}

describe('admin listing details', () => {
  it.each(['ACTIVE', 'RESERVED', 'PENDING_REVIEW', 'CHANGES_REQUESTED'] as const)(
    'edits %s without changing its status or public URL',
    async (status) => {
      const c = await candidate(status);
      const before = await h.prisma.listing.findUniqueOrThrow({ where: { id: c.listingId } });
      const result = await patch(
        c,
        { insuranceType: 'LIVE', pricePaise: 123000000, description: 'Updated by operations.' },
        moderator,
      ).expect(200);
      expect(result.body.listing.status).toBe(status);
      expect(result.body.vehicle).toMatchObject({
        insuranceType: 'LIVE',
        pricePaise: 123000000,
        description: 'Updated by operations.',
      });
      expect(result.body.vehicle).not.toHaveProperty('insuranceValidUntil');
      expect(
        result.body.sections
          .flatMap((section: { rows: { label: string }[] }) => section.rows)
          .some((row: { label: string }) => row.label === 'Insurance valid until'),
      ).toBe(false);
      const after = await h.prisma.listing.findUniqueOrThrow({ where: { id: c.listingId } });
      expect(after.slug).toBe(before.slug);
      expect(after.publishedAt).toEqual(before.publishedAt);
      const audit = await h.prisma.auditLog.findFirstOrThrow({
        where: { entityId: c.listingId, action: 'listing.details_updated' },
      });
      expect(audit).toMatchObject({
        actorType: 'ADMIN',
        before: { insuranceType: 'NONE', pricePaise: '145000000' },
        after: { insuranceType: 'LIVE', pricePaise: '123000000' },
      });
      if (status === 'PENDING_REVIEW')
        expect(result.body.checks.every((check: { checked: boolean }) => !check.checked)).toBe(
          true,
        );
      if (before.slug) {
        const publicView = await h.agent().get(`/v1/vehicles/${before.slug}`).expect(200);
        expect(publicView.body.specs).toContainEqual({ label: 'Insurance', value: 'Live' });
        expect(
          publicView.body.specs.some(
            (row: { label: string }) => row.label === 'Insurance valid until',
          ),
        ).toBe(false);
      }
      await owner.agent
        .patch(`/v1/dealer/vehicles/${c.vehicleId}`)
        .send({ insuranceType: 'NONE' })
        .expect(status === 'CHANGES_REQUESTED' ? 200 : 409);
    },
  );
  it('does not clear checks or record history for an unchanged patch', async () => {
    const c = await candidate('PENDING_REVIEW');
    const result = await patch(c, { insuranceType: 'NONE', pricePaise: 145000000 }).expect(200);
    expect(result.body.vehicle.updatedAt).toBe(c.detail.vehicle.updatedAt);
    expect(result.body.checks.every((check: { checked: boolean }) => check.checked)).toBe(true);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: c.listingId, action: 'listing.details_updated' },
      }),
    ).toBe(0);
  });
  it('advances the version even when the stored timestamp is ahead of the clock', async () => {
    const c = await candidate();
    const ahead = new Date(Date.now() + 86400000);
    await h.prisma.vehicle.update({ where: { id: c.vehicleId }, data: { updatedAt: ahead } });
    c.detail = AdminListingDetail.parse(
      (await admin.get(`/v1/admin/listings/${c.listingId}`).expect(200)).body,
    );
    const saved = await patch(c, { insuranceType: 'LIVE' }).expect(200);
    expect(new Date(saved.body.vehicle.updatedAt).getTime()).toBeGreaterThan(ahead.getTime());
    await patch(c, { insuranceType: 'NONE' }).expect(409);
  });
  it('lets admins confirm migrated unknown insurance on an active listing', async () => {
    const c = await candidate();
    await h.prisma.vehicle.update({ where: { id: c.vehicleId }, data: { insuranceType: null } });
    c.detail = AdminListingDetail.parse(
      (await admin.get(`/v1/admin/listings/${c.listingId}`).expect(200)).body,
    );
    expect(c.detail.issues).toContainEqual({
      field: 'insuranceType',
      message: 'Insurance is required.',
    });
    await patch(c, { insuranceType: 'LIVE' }).expect(200);
  });
  it('refuses stale edits and allows only one concurrent editor to save', async () => {
    const c = await candidate();
    const results = await Promise.all([
      patch(c, { model: 'First edit' }),
      patch(c, { model: 'Second edit' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('VEHICLE_CHANGED');
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: c.listingId, action: 'listing.details_updated' },
      }),
    ).toBe(1);
  });
  it('rolls back invalid active edits including their audit/history', async () => {
    const c = await candidate();
    await patch(c, { make: null, pricePaise: null }).expect(422);
    await patch(c, { registrationYear: 2020 }).expect(422);
    await patch(c, { make: 'Invented Manufacturer' }).expect(422);
    const stored = await h.prisma.vehicle.findUniqueOrThrow({ where: { id: c.vehicleId } });
    expect(stored).toMatchObject({
      make: 'Hyundai',
      registrationYear: 2023,
      pricePaise: 145000000n,
      updatedAt: new Date(c.detail.vehicle.updatedAt),
    });
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: c.listingId, action: 'listing.details_updated' },
      }),
    ).toBe(0);
  });
  it('preserves unchanged legacy makes but refuses a new unknown make', async () => {
    const c = await candidate();
    await h.prisma.vehicle.update({
      where: { id: c.vehicleId },
      data: { make: 'Legacy Manufacturer' },
    });
    c.detail = AdminListingDetail.parse(
      (await admin.get(`/v1/admin/listings/${c.listingId}`).expect(200)).body,
    );
    await patch(c, { make: 'Legacy Manufacturer', insuranceType: 'LIVE' }).expect(200);
  });
  it('validates registration uniqueness across dealerships and rolls back duplicates', async () => {
    const c = await candidate();
    const taken = await candidate('ACTIVE', other);
    await patch(c, { registrationNumber: taken.detail.vehicle.registrationNumber }).expect(409);
    expect(
      (await h.prisma.vehicle.findUniqueOrThrow({ where: { id: c.vehicleId } })).registrationNumber,
    ).toBe(c.detail.vehicle.registrationNumber);
    const changed = await patch(c, { registrationNumber: 'TN 22 ZX 9999' }).expect(200);
    expect(changed.body.vehicle).toMatchObject({
      registrationNumber: 'TN22ZX9999',
      rtoCode: 'TN22',
    });
  });
  it.each(['SOLD', 'WITHDRAWN'] as const)('refuses edits to %s', async (status) => {
    const c = await candidate(status);
    expect(c.detail.actions.canEdit).toBe(false);
    await patch(c, { insuranceType: 'LIVE' }).expect(409);
  });
  it('accepts an empty patch without touching data or audit history', async () => {
    const c = await candidate();
    await patch(c, {}).expect(200);
    expect(
      (
        await h.prisma.vehicle.findUniqueOrThrow({ where: { id: c.vehicleId } })
      ).updatedAt.toISOString(),
    ).toBe(c.detail.vehicle.updatedAt);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: c.listingId, action: 'listing.details_updated' },
      }),
    ).toBe(0);
  });
  it('rejects removed insurance types/date and protected fields', async () => {
    const c = await candidate();
    for (const details of [
      { insuranceType: 'COMPREHENSIVE' },
      { insuranceValidUntil: '2027-01-01' },
      { dealerId: other.dealerId },
      { status: 'SOLD' },
      { pricePaise: 3.5 },
    ])
      await patch(c, details).expect(400);
  });
  it('blocks an assistant from editing or deciding their own listing', async () => {
    const c = await candidate();
    const member = await h.prisma.adminMember.findFirstOrThrow({
      where: { role: 'MODERATOR', user: { email: { startsWith: 'admin-listing-management.' } } },
    });
    await h.prisma.vehicle.update({
      where: { id: c.vehicleId },
      data: { createdByMemberId: member.id },
    });
    const response = await moderator.get(`/v1/admin/listings/${c.listingId}`).expect(200);
    expect(response.body.actions).toMatchObject({
      canEdit: false,
      canReserve: false,
      canMarkSold: false,
    });
    await patch(c, { insuranceType: 'LIVE' }, moderator).expect(403);
    await moderator.post(`/v1/admin/listings/${c.listingId}/reserve`).expect(403);
  });
});

describe('admin availability', () => {
  it('reserves and sells with timestamps, audit, registration release and request cancellation', async () => {
    const c = await candidate();
    const reserved = await moderator.post(`/v1/admin/listings/${c.listingId}/reserve`).expect(200);
    expect(reserved.body.actions).toMatchObject({
      canReserve: false,
      canMarkSold: true,
      canEdit: true,
    });
    let listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: c.listingId } });
    expect(listing.reservedAt).toBeInstanceOf(Date);
    expect(
      (await h.prisma.vehicle.findUniqueOrThrow({ where: { id: c.vehicleId } })).releasedAt,
    ).toBeNull();
    await owner.agent
      .post(`/v1/dealer/vehicles/${c.vehicleId}/request-reactivation`)
      .send({ reason: 'Buyer changed their mind.' })
      .expect(200);
    await moderator.post(`/v1/admin/listings/${c.listingId}/mark-sold`).expect(200);
    listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: c.listingId } });
    expect(listing.soldAt).toBeInstanceOf(Date);
    expect(
      (await h.prisma.vehicle.findUniqueOrThrow({ where: { id: c.vehicleId } })).releasedAt,
    ).toBeInstanceOf(Date);
    expect(
      (
        await h.prisma.listingReactivationRequest.findFirstOrThrow({
          where: { listingId: c.listingId },
        })
      ).status,
    ).toBe('CANCELLED');
    expect(
      (
        await h.prisma.auditLog.findMany({
          where: {
            entityId: c.listingId,
            action: { in: ['listing.reserved', 'listing.marked_sold'] },
          },
        })
      ).every((row) => row.actorType === 'ADMIN'),
    ).toBe(true);
    await admin.post(`/v1/admin/listings/${c.listingId}/reserve`).expect(409);
    await admin.post(`/v1/admin/listings/${c.listingId}/mark-sold`).expect(409);
  });
  it('supports Active directly to Sold and rejects repeated concurrent reservations', async () => {
    const direct = await candidate();
    await admin.post(`/v1/admin/listings/${direct.listingId}/mark-sold`).expect(200);
    const c = await candidate();
    const results = await Promise.all([
      admin.post(`/v1/admin/listings/${c.listingId}/reserve`),
      moderator.post(`/v1/admin/listings/${c.listingId}/reserve`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: c.listingId, action: 'listing.reserved' },
      }),
    ).toBe(1);
  });
  it('never edits a vehicle after a simultaneous sale', async () => {
    const c = await candidate();
    const results = await Promise.all([
      admin.post(`/v1/admin/listings/${c.listingId}/mark-sold`),
      patch(c, { insuranceType: 'LIVE' }),
    ]);
    expect(results[0]?.status).toBe(200);
    expect([200, 409]).toContain(results[1]?.status);
    const after = await admin.get(`/v1/admin/listings/${c.listingId}`).expect(200);
    expect(after.body.listing.status).toBe('SOLD');
    await patch(c, { insuranceType: 'NONE' }).expect(409);
  });
  it('rejects availability actions in review', async () => {
    const c = await candidate('PENDING_REVIEW');
    await admin.post(`/v1/admin/listings/${c.listingId}/reserve`).expect(409);
    await admin.post(`/v1/admin/listings/${c.listingId}/mark-sold`).expect(409);
  });
});

describe('authorization and public dealer details', () => {
  it('refuses support, sales, dealer and anonymous writes', async () => {
    const c = await candidate();
    for (const agent of [support, sales, owner.agent, other.agent, h.agent()]) {
      const expected = agent === support || agent === sales ? 403 : 401;
      await patch(c, { insuranceType: 'LIVE' }, agent).expect(expected);
      await agent.post(`/v1/admin/listings/${c.listingId}/reserve`).expect(expected);
      await agent.post(`/v1/admin/listings/${c.listingId}/mark-sold`).expect(expected);
    }
  });
  it('returns useful errors for malformed and absent ids', async () => {
    await admin
      .patch('/v1/admin/listings/not-an-id/vehicle')
      .send({ details: {}, expectedUpdatedAt: new Date().toISOString() })
      .expect(400);
    await admin
      .patch(`/v1/admin/listings/${randomUUID()}/vehicle`)
      .send({ details: {}, expectedUpdatedAt: new Date().toISOString() })
      .expect(404);
    await admin.post(`/v1/admin/listings/${randomUUID()}/reserve`).expect(404);
    await admin.post(`/v1/admin/listings/${randomUUID()}/mark-sold`).expect(404);
  });
  it('omits unknown dealership age and response time from portfolio and directory', async () => {
    await h.prisma.dealer.update({
      where: { id: owner.dealerId },
      data: { establishedYear: 2000, medianResponseMins: 5 },
    });
    await owner.agent.patch('/v1/dealer').send({ establishedYear: null }).expect(200);
    const profile = await h.agent().get(`/v1/dealers/${owner.slug}`).expect(200);
    expect(
      profile.body.stats.some((stat: { key: string }) => ['years', 'response'].includes(stat.key)),
    ).toBe(false);
    const directory = await h
      .agent()
      .get('/v1/dealers?q=admin-listing-management&limit=48')
      .expect(200);
    const card = directory.body.data.find((dealer: { slug: string }) => dealer.slug === owner.slug);
    expect(card.yearsOperating).toBeNull();
    expect(card.yearsLabel).not.toMatch(/year/);
  });
});
