import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Dealers-Drive's photography progress (**R45**): recorded by hand, internal,
 * and never a substitute for the images themselves.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let plate = 5000;

async function submitted(): Promise<{ vehicleId: string; listingId: string }> {
  plate += 1;
  const created = await a.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `KL 07 PH ${String(plate)}` })
    .expect(201);
  await a.agent.patch(`/v1/dealer/vehicles/${created.body.id}`).send(COMPLETE_VEHICLE).expect(200);
  const done = await a.agent.post(`/v1/dealer/vehicles/${created.body.id}/submit`).expect(200);
  return { vehicleId: created.body.id as string, listingId: done.body.listing.id as string };
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'photography');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

describe('photography progress', () => {
  it('starts as not photographed, and moves as the team records it', async () => {
    const { listingId, vehicleId } = await submitted();

    const before = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(before.body.photography).toMatchObject({
      status: 'NOT_STARTED',
      label: 'Not photographed',
      note: null,
      canUpdate: true,
    });

    const scheduled = await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'SCHEDULED', note: 'Tuesday 10am at the yard.' })
      .expect(200);
    expect(scheduled.body.photography).toMatchObject({
      status: 'SCHEDULED',
      label: 'Shoot scheduled',
      note: 'Tuesday 10am at the yard.',
    });

    const processing = await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'PROCESSING' })
      .expect(200);
    expect(processing.body.photography).toMatchObject({
      status: 'PROCESSING',
      note: 'Tuesday 10am at the yard.',
    });

    const queue = await admin
      .get(`/v1/admin/listings?q=${encodeURIComponent('KL07PH')}`)
      .expect(200);
    const row = queue.body.data.find(
      (entry: { vehicleId: string }) => entry.vehicleId === vehicleId,
    );
    expect(row.photography).toMatchObject({
      status: 'PROCESSING',
      label: 'Processing in StudioCar',
    });

    const audits = await h.prisma.auditLog.findMany({
      where: { entityType: 'Vehicle', entityId: vehicleId, action: 'vehicle.photography_set' },
      orderBy: { id: 'asc' },
    });
    expect(audits.map((entry) => entry.after)).toEqual([
      { status: 'SCHEDULED', listingId },
      { status: 'PROCESSING', listingId },
    ]);
  });

  it('clears the note when asked to, and keeps the note internal', async () => {
    const { listingId, vehicleId } = await submitted();
    await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'PHOTOGRAPHED', note: 'Batch 7, rear bumper scuff.' })
      .expect(200);

    const dealerView = await a.agent.get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(JSON.stringify(dealerView.body)).not.toContain('Batch 7');

    const cleared = await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'PHOTOGRAPHED', note: null })
      .expect(200);
    expect(cleared.body.photography.note).toBeNull();
  });

  it('refuses an unknown status or a StudioCar id nobody issued', async () => {
    const { listingId } = await submitted();
    await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'DONE' })
      .expect(400);
    const refused = await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'READY', studioCarBatchId: 'fake-123' })
      .expect(400);
    expect(JSON.stringify(refused.body)).toContain('studioCarBatchId');
  });

  it('is closed once the listing has left review', async () => {
    const { listingId } = await submitted();
    await admin
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'Not a genuine listing.' })
      .expect(200);

    const refused = await admin
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'READY' })
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'PHOTOGRAPHY_CLOSED', listingStatus: 'REJECTED' });
    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.photography.canUpdate).toBe(false);
  });

  it('is an admin decision, never a dealer’s', async () => {
    const { listingId } = await submitted();
    await a.agent
      .put(`/v1/admin/listings/${listingId}/photography`)
      .send({ status: 'READY' })
      .expect(401);
  });
});
