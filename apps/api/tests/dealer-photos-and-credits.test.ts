import { createHmac } from 'node:crypto';

import { ListingCheckKey, STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';
import { FAKE_WEBHOOK_SECRET } from '../src/platform/payments/fake.adapter.js';

/**
 * Dealer photographs and listing credits, end to end, on the real API.
 *
 * The flags ship off; each describe block turns on what it needs through the
 * admin console's own route and the suite turns both off again at the end,
 * so the rest of the run sees the defaults.
 */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

let h: AuthHarness;
let admin: request.Agent;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let a: Dealership;
let b: Dealership;
let plate = 7000;

function nextPlate(): string {
  plate += 1;
  return `TN 23 DP ${String(plate)}`;
}

async function flag(key: string, value: unknown): Promise<void> {
  await admin.put(`/v1/admin/config/${key}`).send({ value }).expect(200);
}

async function draft(owner: Dealership = a): Promise<string> {
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: nextPlate() })
    .expect(201);
  await owner.agent
    .patch(`/v1/dealer/vehicles/${created.body.id}`)
    .send(COMPLETE_VEHICLE)
    .expect(200);
  return created.body.id as string;
}

async function uploadPhoto(
  owner: Dealership,
  vehicleId: string,
  slot: string,
  body: Buffer = JPEG,
): Promise<request.Response> {
  const signed = await owner.agent
    .post(`/v1/dealer/vehicles/${vehicleId}/photos/presign`)
    .send({ slot, fileName: `${slot}.jpg`, mimeType: 'image/jpeg', bytes: body.length })
    .expect(201);
  const url = new URL(String(signed.body.uploadUrl));
  await owner.agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'image/jpeg')
    .send(body)
    .expect(200);
  return owner.agent.post(`/v1/dealer/vehicles/${vehicleId}/photos/${signed.body.mediaId}/commit`);
}

async function uploadAll(owner: Dealership, vehicleId: string): Promise<void> {
  for (const slot of STANDARD_PHOTO_SLOTS) {
    await (
      await uploadPhoto(owner, vehicleId, slot)
    ).body;
  }
}

async function grant(owner: Dealership, credits: number): Promise<void> {
  await admin
    .post(`/v1/admin/dealers/${owner.dealerId}/credits`)
    .send({ credits, note: 'Test grant' })
    .expect(200);
}

async function balance(owner: Dealership) {
  return (await owner.agent.get('/v1/dealer/billing/summary').expect(200)).body as {
    balance: number;
    held: number;
    available: number;
  };
}

async function verifyAll(listingId: string): Promise<void> {
  for (const key of ListingCheckKey.options) {
    await admin
      .put(`/v1/admin/listings/${listingId}/checks/${key}`)
      .send({ checked: true })
      .expect(200);
  }
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'dealerphotos');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await flag('feature.dealerPhotos', false);
  await flag('feature.listingCredits', false);
  await h.close();
});

describe('with both features off — the live behaviour', () => {
  it('submits exactly as before: no plan, no photographs, no credits', async () => {
    const id = await draft();
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    expect(submitted.body.listing.status).toBe('PENDING_REVIEW');
    expect(await h.prisma.creditTransaction.count({ where: { dealerId: a.dealerId } })).toBe(0);
  });

  it('refuses every photograph write, and reports the step as off', async () => {
    const id = await draft();
    const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(photos.body).toMatchObject({ enabled: false, ready: true, canEdit: false });
    const refused = await a.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(409);
    expect(refused.body.code).toBe('DEALER_PHOTOS_DISABLED');
  });
});

describe('dealer photographs', () => {
  beforeAll(async () => {
    await flag('feature.dealerPhotos', true);
  });

  it('asks for a plan before a car can be submitted', async () => {
    const id = await draft();
    const refused = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(422);
    expect(refused.body.code).toBe('PHOTO_PLAN_REQUIRED');
  });

  it('names every missing shot, then submits once all ten are uploaded', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadPhoto(a, id, 'FRONT').then((response) => expect(response.status).toBe(200));

    const refused = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(422);
    expect(refused.body.code).toBe('PHOTOS_INCOMPLETE');
    expect(refused.body.errors).toHaveLength(9);

    await uploadAll(a, id);
    const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(photos.body).toMatchObject({ plan: 'DEALER', missing: [], ready: true });
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
  });

  it('replaces a shot rather than stacking two in one slot', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadPhoto(a, id, 'REAR');
    const second = await uploadPhoto(a, id, 'REAR');
    expect(second.status).toBe(200);
    expect(
      await h.prisma.vehicleSubmissionPhoto.count({ where: { vehicleId: id, slot: 'REAR' } }),
    ).toBe(1);
  });

  it('refuses a file that is not an image, whatever it says it is', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    const refused = await uploadPhoto(a, id, 'FRONT', Buffer.from('%PDF-1.7 not a photo'));
    expect(refused.status).toBe(422);
    expect(refused.body.code).toBe('UPLOAD_NOT_IMAGE');
  });

  it('never serves a dealer photograph publicly — not even after the car is live', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadAll(a, id);
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    const listingId = submitted.body.listing.id as string;

    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.submittedPhotos.plan).toBe('DEALER');
    expect(detail.body.submittedPhotos.items).toHaveLength(10);
    expect(detail.body.submittedPhotos.items[0].downloadName).toMatch(
      /^TN23DP\d+-01-front-three-quarter\.jpg$/,
    );

    await verifyAll(listingId);
    await seedImages(h.prisma, { vehicleId: id, dealerId: a.dealerId }, 6, 'DEALER');
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);

    const raw = await h.prisma.vehicleSubmissionPhoto.findFirstOrThrow({
      where: { vehicleId: id },
    });
    await h.agent().get(`/media/by-media/${raw.mediaId}/1024.webp`).expect(404);
  });

  it('keeps photographs locked once the car is in review, and private to the dealership', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadAll(a, id);
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);

    const locked = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'FRONT', fileName: 'f.jpg', mimeType: 'image/jpeg', bytes: 10 })
      .expect(409);
    expect(locked.body.code).toBe('PHOTOS_CLOSED');
    await b.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(404);
  });

  it('offers a Dealers-Drive photoshoot only where the district has photography', async () => {
    const id = await draft();
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: a.dealerId } });
    expect(dealer.serviceDistrictId).not.toBeNull();
    await h.prisma.serviceDistrict.update({
      where: { id: dealer.serviceDistrictId ?? '' },
      data: { photographyAvailable: false },
    });
    try {
      const refused = await a.agent
        .put(`/v1/dealer/vehicles/${id}/photo-plan`)
        .send({ plan: 'DEALERS_DRIVE' })
        .expect(422);
      expect(refused.body.code).toBe('PHOTOSHOOT_UNAVAILABLE');
    } finally {
      await h.prisma.serviceDistrict.update({
        where: { id: dealer.serviceDistrictId ?? '' },
        data: { photographyAvailable: true },
      });
    }
    await a.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALERS_DRIVE' })
      .expect(200);
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
  });

  it('deletes a draft’s photographs with the draft', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadPhoto(a, id, 'FRONT');
    const { mediaId } = await h.prisma.vehicleSubmissionPhoto.findFirstOrThrow({
      where: { vehicleId: id },
    });
    await a.agent.delete(`/v1/dealer/vehicles/${id}`).expect(204);
    expect((await h.prisma.media.findUniqueOrThrow({ where: { id: mediaId } })).status).toBe(
      'ORPHAN',
    );
  });
});

describe('listing credits', () => {
  beforeAll(async () => {
    await flag('feature.dealerPhotos', true);
    await flag('feature.listingCredits', true);
  });

  it('refuses a submission the dealership cannot pay for, and changes nothing', async () => {
    const owner = await fixtures.dealership();
    const id = await draft(owner);
    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(200);
    await uploadAll(owner, id);

    const refused = await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(422);
    expect(refused.body).toMatchObject({ code: 'INSUFFICIENT_CREDITS', required: 1, available: 0 });
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(listing).toMatchObject({ status: 'DRAFT', creditsHeld: 0 });
    const vehicle = await h.prisma.vehicle.findUniqueOrThrow({ where: { id } });
    expect(vehicle.claimedAt).toBeNull();
  });

  it('holds on submit, consumes on approval — one credit for the dealer’s own photographs', async () => {
    const owner = await fixtures.dealership();
    await grant(owner, 3);
    const id = await draft(owner);
    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(200);
    await uploadAll(owner, id);
    const submitted = await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    expect(await balance(owner)).toMatchObject({ balance: 3, held: 1, available: 2 });

    const listingId = submitted.body.listing.id as string;
    await verifyAll(listingId);
    await seedImages(h.prisma, { vehicleId: id, dealerId: owner.dealerId }, 6, 'DEALER');
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);

    expect(await balance(owner)).toMatchObject({ balance: 2, held: 0, available: 2 });
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing).toMatchObject({ creditsHeld: 0, creditsSpent: 1 });
  });

  it('charges a Dealers-Drive photoshoot two credits, and returns them on rejection', async () => {
    const owner = await fixtures.dealership();
    await grant(owner, 2);
    const id = await draft(owner);
    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALERS_DRIVE' })
      .expect(200);
    const submitted = await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    expect(await balance(owner)).toMatchObject({ held: 2, available: 0 });

    await admin
      .post(`/v1/admin/listings/${submitted.body.listing.id}/reject`)
      .send({ reason: 'Not a car we can list.' })
      .expect(200);
    expect(await balance(owner)).toMatchObject({ balance: 2, held: 0, available: 2 });

    const ledger = await owner.agent.get('/v1/dealer/billing/ledger').expect(200);
    expect(ledger.body.data.map((row: { reason: string }) => row.reason)).toEqual([
      'RELEASE_REJECT',
      'HOLD_SUBMIT',
      'ADMIN_GRANT',
    ]);
  });

  it('keeps the hold through a request for changes, and adjusts it if the plan changes', async () => {
    const owner = await fixtures.dealership();
    await grant(owner, 5);
    const id = await draft(owner);
    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALERS_DRIVE' })
      .expect(200);
    const submitted = await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    await admin
      .post(`/v1/admin/listings/${submitted.body.listing.id}/request-changes`)
      .send({ reason: 'Please upload your own photographs.' })
      .expect(200);
    expect(await balance(owner)).toMatchObject({ held: 2 });

    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(200);
    await uploadAll(owner, id);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    expect(await balance(owner)).toMatchObject({ balance: 5, held: 1, available: 4 });
  });

  it('lets one of two simultaneous submissions through and holds once', async () => {
    const owner = await fixtures.dealership();
    await grant(owner, 1);
    const id = await draft(owner);
    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(200);
    await uploadAll(owner, id);
    const results = await Promise.all([
      owner.agent.post(`/v1/dealer/vehicles/${id}/submit`),
      owner.agent.post(`/v1/dealer/vehicles/${id}/submit`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await balance(owner)).toMatchObject({ held: 1, available: 0 });
  });

  it('approves a listing submitted before credits existed without charging anything', async () => {
    await flag('feature.listingCredits', false);
    await flag('feature.dealerPhotos', false);
    const owner = await fixtures.dealership();
    const id = await draft(owner);
    const submitted = await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    await flag('feature.listingCredits', true);
    await flag('feature.dealerPhotos', true);

    const listingId = submitted.body.listing.id as string;
    await verifyAll(listingId);
    await seedImages(h.prisma, { vehicleId: id, dealerId: owner.dealerId }, 6);
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
    expect(await h.prisma.creditTransaction.count({ where: { dealerId: owner.dealerId } })).toBe(0);
  });

  it('refuses an admin deduction below what is held', async () => {
    const owner = await fixtures.dealership();
    await grant(owner, 1);
    const id = await draft(owner);
    await owner.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(200);
    await uploadAll(owner, id);
    await owner.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    const refused = await admin
      .post(`/v1/admin/dealers/${owner.dealerId}/credits`)
      .send({ credits: -1, note: 'Correction' })
      .expect(422);
    expect(refused.body.code).toBe('CREDITS_NEGATIVE');
  });
});

describe('buying credits', () => {
  it('lists packs with GST and refuses an amount from the client', async () => {
    const packs = await a.agent.get('/v1/dealer/billing/packs').expect(200);
    expect(packs.body.data[0]).toMatchObject({
      id: 'pack-1',
      credits: 1,
      pricePaise: 50000,
      totalPaise: 59000,
    });
    expect(packs.body.data[1]).toMatchObject({ id: 'pack-5', savingsLabel: 'Save 10%' });
    await a.agent
      .post('/v1/dealer/billing/orders')
      .send({ packId: 'pack-5', amountPaise: 1 })
      .expect(400);
  });

  it('buys a pack through checkout and verify, and credits it exactly once', async () => {
    const owner = await fixtures.dealership();
    const checkout = await owner.agent
      .post('/v1/dealer/billing/orders')
      .send({ packId: 'pack-5' })
      .expect(201);
    expect(checkout.body).toMatchObject({
      gateway: 'fake',
      credits: 5,
      totalPaise: 265_500,
      currency: 'INR',
    });

    const payload = {
      razorpayOrderId: checkout.body.gatewayOrderId,
      razorpayPaymentId: checkout.body.simulation.paymentId,
      razorpaySignature: checkout.body.simulation.signature,
    };
    const paid = await owner.agent
      .post(`/v1/dealer/billing/orders/${checkout.body.orderId}/verify`)
      .send(payload)
      .expect(200);
    expect(paid.body).toMatchObject({ status: 'PAID', balance: 5, available: 5 });

    await owner.agent
      .post(`/v1/dealer/billing/orders/${checkout.body.orderId}/verify`)
      .send(payload)
      .expect(200);
    expect(await balance(owner)).toMatchObject({ balance: 5 });

    const orders = await owner.agent.get('/v1/dealer/billing/orders').expect(200);
    expect(orders.body.data[0]).toMatchObject({ status: 'PAID', credits: 5, totalLabel: '₹2,655' });
  });

  it('refuses a forged signature and adds nothing', async () => {
    const owner = await fixtures.dealership();
    const checkout = await owner.agent
      .post('/v1/dealer/billing/orders')
      .send({ packId: 'pack-1' })
      .expect(201);
    const refused = await owner.agent
      .post(`/v1/dealer/billing/orders/${checkout.body.orderId}/verify`)
      .send({
        razorpayOrderId: checkout.body.gatewayOrderId,
        razorpayPaymentId: 'pay_forged',
        razorpaySignature: 'a'.repeat(64),
      })
      .expect(400);
    expect(refused.body.code).toBe('SIGNATURE_MISMATCH');
    expect(await balance(owner)).toMatchObject({ balance: 0 });
  });

  it('credits from the webhook when the buyer closed the tab, once however often it arrives', async () => {
    const owner = await fixtures.dealership();
    const checkout = await owner.agent
      .post('/v1/dealer/billing/orders')
      .send({ packId: 'pack-1' })
      .expect(201);
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook1',
            order_id: checkout.body.gatewayOrderId,
            amount: 59_000,
            status: 'captured',
          },
        },
      },
    });
    const signature = createHmac('sha256', FAKE_WEBHOOK_SECRET).update(body).digest('hex');
    const send = (eventId: string) =>
      h
        .agent()
        .post('/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .set('X-Razorpay-Event-Id', eventId)
        .send(body);

    expect((await send('evt_1').expect(200)).body).toEqual({ outcome: 'fulfilled' });
    expect((await send('evt_1').expect(200)).body).toEqual({ outcome: 'duplicate' });
    expect((await send('evt_2').expect(200)).body).toEqual({ outcome: 'already-paid' });
    expect(await balance(owner)).toMatchObject({ balance: 1 });

    await h
      .agent()
      .post('/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'b'.repeat(64))
      .send(body)
      .expect(400);
  });

  it('keeps purchase to the owner', async () => {
    const manager = await fixtures.member(a, 'MANAGER');
    await manager.agent.post('/v1/dealer/billing/orders').send({ packId: 'pack-1' }).expect(403);
  });
});
