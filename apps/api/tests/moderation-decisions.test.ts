import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Requesting changes and rejecting (**F070**, as revised by **R47**), and the
 * dealer's side of both.
 */
let h: AuthHarness;
let admin: request.Agent;
let secondAdmin: request.Agent;
let a: Dealership;
let plate = 4000;

async function submitted(): Promise<{ vehicleId: string; listingId: string }> {
  plate += 1;
  const created = await a.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `GJ 01 DC ${String(plate)}` })
    .expect(201);
  await a.agent.patch(`/v1/dealer/vehicles/${created.body.id}`).send(COMPLETE_VEHICLE).expect(200);
  const done = await a.agent.post(`/v1/dealer/vehicles/${created.body.id}/submit`).expect(200);
  return { vehicleId: created.body.id as string, listingId: done.body.listing.id as string };
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'decisions');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
  secondAdmin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

describe('requesting changes', () => {
  it('sends the listing back with the reason, and the dealer sees it, edits and resubmits', async () => {
    const { vehicleId, listingId } = await submitted();
    const reason = 'The odometer reads 32,400 km, not 22,400 km.';

    const sent = await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason })
      .expect(200);
    expect(sent.body.listing).toMatchObject({ status: 'CHANGES_REQUESTED', reason });
    expect(sent.body.history.at(-1)).toMatchObject({ label: 'Changes requested', reason });

    const dealerView = await a.agent.get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(dealerView.body.listing).toMatchObject({
      status: 'CHANGES_REQUESTED',
      reason,
      canEdit: true,
      canSubmit: true,
    });
    const inventory = await a.agent.get('/v1/dealer/vehicles?status=CHANGES_REQUESTED').expect(200);
    expect(
      inventory.body.data.map((row: { id: string; reason: string }) => [row.id, row.reason]),
    ).toContainEqual([vehicleId, reason]);

    await a.agent
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send({ kilometersDriven: 32_400 })
      .expect(200);
    await a.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);

    const back = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(back.body.listing).toMatchObject({
      status: 'PENDING_REVIEW',
      resubmission: true,
      submissionCount: 2,
    });
    expect(back.body.history.map((entry: { label: string }) => entry.label)).toEqual([
      'Submitted for review',
      'Changes requested',
      'Resubmitted after changes',
    ]);
  });

  it('needs a meaningful reason', async () => {
    const { listingId } = await submitted();
    await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'no' })
      .expect(400);
    await admin.post(`/v1/admin/listings/${listingId}/request-changes`).send({}).expect(400);
    await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Fix the price please.', status: 'ACTIVE' })
      .expect(400);
  });

  it('refuses a listing that is not waiting for review', async () => {
    const { listingId } = await submitted();
    await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Please fix the variant.' })
      .expect(200);
    const again = await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Please fix the variant.' })
      .expect(409);
    expect(again.body.code).toBe('LISTING_NOT_REVIEWABLE');
  });
});

describe('rejecting', () => {
  it('rejects with a reason, keeps the vehicle as history and releases the plate', async () => {
    const { vehicleId, listingId } = await submitted();
    const reason = 'This car is already listed by another dealership.';

    const rejected = await admin
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason })
      .expect(200);
    expect(rejected.body.listing).toMatchObject({ status: 'REJECTED', reason });
    expect(rejected.body.actions).toMatchObject({
      canVerify: false,
      canReject: false,
      canRequestChanges: false,
    });

    const dealerView = await a.agent.get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(dealerView.body.listing).toMatchObject({
      status: 'REJECTED',
      reason,
      canEdit: false,
      canSubmit: false,
      canDelete: false,
    });
    await a.agent.delete(`/v1/dealer/vehicles/${vehicleId}`).expect(409);

    const vehicle = await h.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    expect(vehicle.releasedAt).toBeInstanceOf(Date);
    await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: vehicle.registrationNumber })
      .expect(201);
  });

  it('is final', async () => {
    const { listingId } = await submitted();
    await admin
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'Not genuine.' })
      .expect(200);
    const again = await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Changed my mind.' })
      .expect(409);
    expect(again.body.code).toBe('LISTING_NOT_REVIEWABLE');
  });
});

describe('two moderators at once', () => {
  it('lets exactly one decision through and records only that one', async () => {
    const { listingId } = await submitted();

    const results = await Promise.all([
      admin.post(`/v1/admin/listings/${listingId}/reject`).send({ reason: 'Duplicate listing.' }),
      secondAdmin
        .post(`/v1/admin/listings/${listingId}/request-changes`)
        .send({ reason: 'Please add the variant.' }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const decisions = await h.prisma.auditLog.count({
      where: {
        entityId: listingId,
        action: { in: ['listing.rejected', 'listing.changes_requested'] },
      },
    });
    expect(decisions).toBe(1);
  });
});

describe('who may decide', () => {
  it('refuses a dealer session, even on its own listing', async () => {
    const { listingId } = await submitted();
    await a.agent
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'Self-rejecting.' })
      .expect(401);
    await a.agent
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Self-requesting.' })
      .expect(401);
  });

  it('answers an unknown listing with a 404', async () => {
    await admin
      .post('/v1/admin/listings/00000000-0000-4000-8000-000000000000/reject')
      .send({ reason: 'Nothing here.' })
      .expect(404);
  });
});
