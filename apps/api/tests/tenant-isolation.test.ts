import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, DEALER_A, DEALER_B, type Harness } from './harness.js';

/**
 * CLAUDE.md §26 — every dealer-scoped operation must prove that **Dealer A
 * cannot access Dealer B's data**.
 *
 * The shape of the proof matters as much as the result. A cross-tenant read
 * must answer **404, not 403**: a 403 confirms the id is real, which is a slow
 * enumeration oracle for a competitor with a list of guessed uuids
 * (ARCHITECTURE §5.2).
 */
describe('tenant isolation', () => {
  let h: Harness;
  let vehicleOfB: string;
  let enquiryOfB: string;
  let mediaOfB: string;

  beforeAll(async () => {
    h = await createHarness();

    h.actAs(DEALER_B);
    const inventory = await h.agent().get('/v1/dealer/vehicles').expect(200);
    vehicleOfB = inventory.body.data[0].vehicleId;

    const enquiries = await h.agent().get('/v1/dealer/enquiries?limit=1').expect(200);
    enquiryOfB = enquiries.body.data[0]?.id ?? '';

    const vehicle = await h.agent().get(`/v1/dealer/vehicles/${vehicleOfB}`).expect(200);
    mediaOfB = vehicle.body.media[0]?.mediaId ?? '';

    h.actAs(DEALER_A);
  });

  afterAll(async () => {
    await h.close();
  });

  it('does not list another dealer\'s vehicles', async () => {
    const response = await h.agent().get('/v1/dealer/vehicles').expect(200);
    const ids = response.body.data.map((row: { vehicleId: string }) => row.vehicleId);
    expect(ids).not.toContain(vehicleOfB);
  });

  it('404s reading another dealer\'s vehicle', async () => {
    await h.agent().get(`/v1/dealer/vehicles/${vehicleOfB}`).expect(404);
  });

  it('404s editing another dealer\'s vehicle', async () => {
    await h
      .agent()
      .patch(`/v1/dealer/vehicles/${vehicleOfB}`)
      .send({ kmDriven: 1 })
      .expect(404);
  });

  it('404s submitting another dealer\'s vehicle', async () => {
    await h.agent().post(`/v1/dealer/vehicles/${vehicleOfB}/submit`).send({}).expect(404);
  });

  it('404s deleting another dealer\'s vehicle', async () => {
    await h.agent().delete(`/v1/dealer/vehicles/${vehicleOfB}`).expect(404);
  });

  it('404s updating another dealer\'s enquiry', async () => {
    if (!enquiryOfB) return;
    await h
      .agent()
      .patch(`/v1/dealer/enquiries/${enquiryOfB}`)
      .send({ status: 'CONTACTED' })
      .expect(404);
  });

  it('does not return another dealer\'s enquiries', async () => {
    const response = await h.agent().get('/v1/dealer/enquiries?limit=100').expect(200);
    const ids = response.body.data.map((row: { id: string }) => row.id);
    expect(ids).not.toContain(enquiryOfB);
  });

  it('404s deleting another dealer\'s media', async () => {
    if (!mediaOfB) return;
    await h.agent().delete(`/v1/dealer/media/${mediaOfB}`).expect(404);
  });

  it('refuses to attach media to another dealer\'s vehicle', async () => {
    const response = await h.agent().post('/v1/dealer/media/presign').send({
      ownerType: 'VEHICLE',
      ownerId: vehicleOfB,
      fileName: 'x.jpg',
      mimeType: 'image/jpeg',
      bytes: 1000,
    });
    expect(response.status).toBe(404);
  });

  it('scopes the credit ledger to the acting dealer', async () => {
    const asA = await h.agent().get('/v1/dealer/billing/ledger?limit=100').expect(200);

    h.actAs(DEALER_B);
    const asB = await h.agent().get('/v1/dealer/billing/ledger?limit=100').expect(200);
    h.actAs(DEALER_A);

    const idsA = new Set(asA.body.data.map((row: { id: string }) => row.id));
    const overlap = asB.body.data.filter((row: { id: string }) => idsA.has(row.id));
    expect(overlap).toHaveLength(0);
  });

  it('scopes the dashboard and profile to the acting dealer', async () => {
    const asA = await h.agent().get('/v1/dealer').expect(200);
    expect(asA.body.slug).toBe(DEALER_A);

    h.actAs(DEALER_B);
    const asB = await h.agent().get('/v1/dealer').expect(200);
    h.actAs(DEALER_A);

    expect(asB.body.slug).toBe(DEALER_B);
    expect(asB.body.id).not.toBe(asA.body.id);
  });

  it('ignores a dealerId supplied by the client (Rule 1)', async () => {
    const asA = await h.agent().get('/v1/dealer').expect(200);

    // `.strict()` schemas reject unknown fields outright rather than silently
    // dropping them, so this is a 400 — not a 200 that quietly ignored it.
    await h
      .agent()
      .patch('/v1/dealer')
      .send({ brandName: 'Renamed', dealerId: 'de83c1f4-0000-4000-8000-000000000000' })
      .expect(400);

    const after = await h.agent().get('/v1/dealer').expect(200);
    expect(after.body.id).toBe(asA.body.id);
    expect(after.body.brandName).toBe(asA.body.brandName);
  });
});
