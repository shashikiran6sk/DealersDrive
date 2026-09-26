import { ListingCheckKey } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Approval (**R45**, **R47**): the one decision that publishes a listing,
 * and so the one that is guarded — by the dealer, the data, the checklist
 * and the photographs, all read under the listing's row lock.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let plate = 9000;

interface Candidate {
  listingId: string;
  vehicleId: string;
  mediaIds: string[];
}

async function inReview(owner: Dealership = a): Promise<Candidate> {
  plate += 1;
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `KL 10 AP ${String(plate)}` })
    .expect(201);
  const vehicleId = created.body.id as string;
  await owner.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
  const done = await owner.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
  return { listingId: done.body.listing.id as string, vehicleId, mediaIds: [] };
}

async function tickAll(listingId: string, except: string[] = []): Promise<void> {
  for (const key of ListingCheckKey.options) {
    if (except.includes(key)) continue;
    await admin
      .put(`/v1/admin/listings/${listingId}/checks/${key}`)
      .send({ checked: true })
      .expect(200);
  }
}

async function ready(owner: Dealership = a): Promise<Candidate> {
  const candidate = await inReview(owner);
  await tickAll(candidate.listingId);
  candidate.mediaIds = await seedImages(
    h.prisma,
    { vehicleId: candidate.vehicleId, dealerId: owner.dealerId },
    6,
  );
  return candidate;
}

function blockerCodes(body: { blockers: { code: string }[] }): string[] {
  return body.blockers.map((blocker) => blocker.code);
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'approval');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

describe('approving a listing that is ready', () => {
  it('publishes it, stamps publishedAt, and records who and when', async () => {
    const { listingId, vehicleId } = await ready();

    const before = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(before.body.blockers).toEqual([]);
    expect(before.body.actions.canApprove).toBe(true);

    const approved = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
    expect(approved.body.listing).toMatchObject({ status: 'ACTIVE', statusLabel: 'Active' });
    expect(approved.body.listing.publishedAt).toEqual(expect.any(String));
    expect(approved.body.actions).toMatchObject({ canApprove: false, canReject: false });
    expect(approved.body.images.canEdit).toBe(false);

    const row = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(row.status).toBe('ACTIVE');
    expect(row.decidedAt).not.toBeNull();

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: listingId, action: 'listing.approved' },
    });
    expect(audit).toMatchObject({ actorType: 'ADMIN', entityType: 'Listing' });
    expect(audit.after).toMatchObject({ status: 'ACTIVE', vehicleId });
  });

  it('shows the dealer the listing as live', async () => {
    const { listingId, vehicleId } = await ready();
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);

    const vehicle = await a.agent.get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(vehicle.body.listing).toMatchObject({ status: 'ACTIVE', canEdit: false });
  });

  it('makes its images public', async () => {
    const { listingId, mediaIds } = await ready();
    const path = `/media/by-media/${mediaIds[0]!}/640.webp`;
    const media = await h.prisma.media.findUniqueOrThrow({ where: { id: mediaIds[0]! } });
    await createLocalStorage().put(
      media.storageKey,
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      'image/jpeg',
    );

    await h.agent().get(path).expect(404);
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
    await h.agent().get(path).expect(200);
  });
});

describe('what stops an approval', () => {
  it('refuses too few images, and says how many', async () => {
    const { listingId, vehicleId } = await inReview();
    await tickAll(listingId);
    await seedImages(h.prisma, { vehicleId, dealerId: a.dealerId }, 5);

    const refused = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(409);
    expect(refused.body.code).toBe('LISTING_NOT_READY');
    expect(refused.body.blockers).toEqual([
      { code: 'TOO_FEW_IMAGES', message: '5 of the 6 images needed are uploaded.' },
    ]);

    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(blockerCodes(detail.body)).toEqual(['TOO_FEW_IMAGES']);
    expect(detail.body.actions.canApprove).toBe(false);
    expect((await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe(
      'PENDING_REVIEW',
    );
  });

  it('refuses a listing with no images and no primary', async () => {
    const { listingId } = await inReview();
    await tickAll(listingId);

    const refused = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(409);
    expect(blockerCodes(refused.body)).toEqual(['TOO_FEW_IMAGES', 'NO_PRIMARY_IMAGE']);
  });

  it('refuses an unticked checklist', async () => {
    const { listingId, vehicleId } = await inReview();
    await tickAll(listingId, ['ODOMETER']);
    await seedImages(h.prisma, { vehicleId, dealerId: a.dealerId }, 6);

    const refused = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(409);
    expect(refused.body.blockers).toEqual([
      { code: 'CHECKS_INCOMPLETE', message: '1 verification check is still unticked.' },
    ]);
  });

  it('refuses a dealership that is no longer active', async () => {
    const { listingId } = await ready();
    await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'SUSPENDED' } });
    try {
      const refused = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(409);
      expect(blockerCodes(refused.body)).toEqual(['DEALER_NOT_ACTIVE']);
    } finally {
      await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'ACTIVE' } });
    }
  });

  it('refuses vehicle data that has gone incomplete', async () => {
    const { listingId, vehicleId } = await ready();
    await h.prisma.vehicle.update({ where: { id: vehicleId }, data: { color: null } });

    const refused = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(409);
    expect(blockerCodes(refused.body)).toEqual(['VEHICLE_INCOMPLETE']);
  });

  it('reads the minimum from platform config', async () => {
    const { listingId, vehicleId } = await inReview();
    await tickAll(listingId);
    await seedImages(h.prisma, { vehicleId, dealerId: a.dealerId }, 3);
    await admin.put('/v1/admin/config/listing.minPhotos').send({ value: 3 }).expect(200);
    try {
      const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
      expect(detail.body.images.min).toBe(3);
      await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
    } finally {
      await admin.put('/v1/admin/config/listing.minPhotos').send({ value: 6 }).expect(200);
    }
  });

  it.each([
    ['a listing that was never submitted', 'DRAFT'],
    ['a listing sent back for changes', 'CHANGES_REQUESTED'],
    ['a listing already live', 'ACTIVE'],
  ])('refuses %s as not approvable', async (_label, status) => {
    const { listingId } = await ready();
    await h.prisma.listing.update({
      where: { id: listingId },
      data: { status: status as 'DRAFT' | 'CHANGES_REQUESTED' | 'ACTIVE' },
    });

    const refused = await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(409);
    expect(refused.body).toMatchObject({ code: 'LISTING_NOT_APPROVABLE', listingStatus: status });
  });
});

describe('approval against everything else that can happen at once', () => {
  it('lets exactly one of approve and reject win', async () => {
    const { listingId } = await ready();

    const results = await Promise.all([
      admin.post(`/v1/admin/listings/${listingId}/approve`),
      admin
        .post(`/v1/admin/listings/${listingId}/reject`)
        .send({ reason: 'Duplicate of another listing.' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: listingId, action: { in: ['listing.approved', 'listing.rejected'] } },
      }),
    ).toBe(1);
  });

  it('never publishes below the minimum when an image is removed at the same moment', async () => {
    const { listingId, mediaIds, vehicleId } = await ready();

    const [approve, remove] = await Promise.all([
      admin.post(`/v1/admin/listings/${listingId}/approve`),
      admin.delete(`/v1/admin/listings/${listingId}/images/${mediaIds[5]!}`),
    ]);

    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const count = await h.prisma.vehicleMedia.count({ where: { vehicleId } });
    if (approve.status === 200) {
      expect(remove.status).toBe(409);
      expect(listing.status).toBe('ACTIVE');
      expect(count).toBe(6);
    } else {
      expect(approve.status).toBe(409);
      expect(remove.status).toBe(200);
      expect(listing.status).toBe('PENDING_REVIEW');
      expect(count).toBe(5);
    }
  });

  it('approves once when two moderators press approve together', async () => {
    const { listingId } = await ready();

    const results = await Promise.all([
      admin.post(`/v1/admin/listings/${listingId}/approve`),
      admin.post(`/v1/admin/listings/${listingId}/approve`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(
      await h.prisma.auditLog.count({ where: { entityId: listingId, action: 'listing.approved' } }),
    ).toBe(1);
  });
});

describe('who may approve', () => {
  it('refuses a dealer session', async () => {
    const { listingId } = await ready();
    await a.agent.post(`/v1/admin/listings/${listingId}/approve`).expect(401);
  });

  it('answers 404 for a listing that does not exist', async () => {
    await admin.post(`/v1/admin/listings/${crypto.randomUUID()}/approve`).expect(404);
  });
});
