import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The admin review screen and its checklist (**F070**).
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let plate = 3000;

async function submitted(): Promise<{ vehicleId: string; listingId: string }> {
  plate += 1;
  const created = await a.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `AP 09 RV ${String(plate)}` })
    .expect(201);
  await a.agent.patch(`/v1/dealer/vehicles/${created.body.id}`).send(COMPLETE_VEHICLE).expect(200);
  const done = await a.agent.post(`/v1/dealer/vehicles/${created.body.id}/submit`).expect(200);
  return { vehicleId: created.body.id as string, listingId: done.body.listing.id as string };
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'review');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

describe('the review screen', () => {
  it('shows the dealership, the data in sections, the checklist and what may be decided', async () => {
    const { listingId } = await submitted();
    const { body } = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);

    expect(body.listing).toMatchObject({
      id: listingId,
      status: 'PENDING_REVIEW',
      submissionCount: 1,
    });
    expect(body.dealer).toMatchObject({
      id: a.dealerId,
      status: 'ACTIVE',
      location: 'Katpadi, Vellore',
    });
    expect(body.sections.map((section: { key: string }) => section.key)).toEqual([
      'registration',
      'basics',
      'details',
      'pricing',
    ]);
    expect(body.sections[1].rows).toContainEqual({ label: 'Make', value: 'Hyundai' });
    expect(body.sections[2].rows).toContainEqual({
      label: 'Kilometres driven',
      value: '22,400 km',
    });
    expect(body.sections[3].rows).toContainEqual({ label: 'Price', value: '₹14,50,000' });
    expect(body.issues).toEqual([]);
    expect(body.checks).toHaveLength(7);
    expect(body.checks.every((check: { checked: boolean }) => !check.checked)).toBe(true);
    expect(body.history.map((entry: { label: string }) => entry.label)).toEqual([
      'Submitted for review',
    ]);
    expect(body.actions).toEqual({
      canVerify: true,
      canRequestChanges: true,
      canReject: true,
      canApprove: false,
    });
  });

  it('answers an unknown listing with a 404', async () => {
    const refused = await admin
      .get('/v1/admin/listings/00000000-0000-4000-8000-000000000000')
      .expect(404);
    expect(refused.body.code).toBe('LISTING_NOT_FOUND');
  });

  it('is not reachable from a dealer session, even for the dealer’s own listing', async () => {
    const { listingId } = await submitted();
    await a.agent.get(`/v1/admin/listings/${listingId}`).expect(401);
    await a.agent
      .put(`/v1/admin/listings/${listingId}/checks/ODOMETER`)
      .send({ checked: true })
      .expect(401);
  });
});

describe('the checklist', () => {
  it('ticks and unticks one check at a time, idempotently, and audits each', async () => {
    const { listingId } = await submitted();

    await admin
      .put(`/v1/admin/listings/${listingId}/checks/ODOMETER`)
      .send({ checked: true })
      .expect(200);
    const twice = await admin
      .put(`/v1/admin/listings/${listingId}/checks/ODOMETER`)
      .send({ checked: true })
      .expect(200);
    expect(
      twice.body.checks.find((check: { key: string }) => check.key === 'ODOMETER'),
    ).toMatchObject({
      checked: true,
    });
    expect(await h.prisma.listingCheck.count({ where: { listingId } })).toBe(1);

    const unticked = await admin
      .put(`/v1/admin/listings/${listingId}/checks/ODOMETER`)
      .send({ checked: false })
      .expect(200);
    expect(unticked.body.checks.every((check: { checked: boolean }) => !check.checked)).toBe(true);

    const audits = await h.prisma.auditLog.count({
      where: { entityId: listingId, action: 'listing.check_set' },
    });
    expect(audits).toBe(3);
  });

  it('refuses an unknown check or a malformed body', async () => {
    const { listingId } = await submitted();
    await admin
      .put(`/v1/admin/listings/${listingId}/checks/PAINT`)
      .send({ checked: true })
      .expect(400);
    await admin
      .put(`/v1/admin/listings/${listingId}/checks/YEAR`)
      .send({ checked: true, by: 'someone' })
      .expect(400);
  });

  it('refuses to verify a listing that is not waiting for review', async () => {
    const { listingId } = await submitted();
    await h.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'CHANGES_REQUESTED' },
    });

    const refused = await admin
      .put(`/v1/admin/listings/${listingId}/checks/YEAR`)
      .send({ checked: true })
      .expect(409);
    expect(refused.body).toMatchObject({
      code: 'LISTING_NOT_REVIEWABLE',
      listingStatus: 'CHANGES_REQUESTED',
    });
  });

  it('is cleared when the dealer resubmits, so a check never outlives the data it checked', async () => {
    const { vehicleId, listingId } = await submitted();
    await admin
      .put(`/v1/admin/listings/${listingId}/checks/PRICING`)
      .send({ checked: true })
      .expect(200);

    await h.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'CHANGES_REQUESTED' },
    });
    await a.agent
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send({ pricePaise: 140_000_000 })
      .expect(200);
    await a.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);

    const { body } = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(body.checks.every((check: { checked: boolean }) => !check.checked)).toBe(true);
    expect(body.listing.resubmission).toBe(true);
  });
});
