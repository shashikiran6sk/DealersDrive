import { ListingCheckKey, STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';
import { readZip } from './zip-reader.js';

/**
 * Dealer photographs, end to end, on the real API.
 *
 * The flag ships off; the photographs block turns it on through the admin
 * console's own route and the suite turns it off again at the end, so the rest
 * of the run sees the default.
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
  await h.close();
});

describe('with the feature off — the live behaviour', () => {
  it('submits exactly as before: no plan, no photographs', async () => {
    const id = await draft();
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    expect(submitted.body.listing.status).toBe('PENDING_REVIEW');
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

  it('asks nothing of a car that already has finished photos, so changes can go back as before', async () => {
    const id = await draft();
    await seedImages(h.prisma, { vehicleId: id, dealerId: a.dealerId }, 6, 'DEALERS_DRIVE');
    const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(photos.body).toMatchObject({ plan: null, ready: true });
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
  });

  it('takes photographs uploaded all at once and submits once there are ten', async () => {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadPhoto(a, id, 'FRONT');
    for (let index = 0; index < 7; index += 1) await uploadPhoto(a, id, 'UNSORTED');

    const short = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(short.body).toMatchObject({ needed: 2, ready: false });
    expect(short.body.unsorted).toHaveLength(7);
    const refused = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(422);
    expect(refused.body.code).toBe('PHOTOS_INCOMPLETE');
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ field: 'photos', code: 'REQUIRED' }),
    ]);

    await uploadPhoto(a, id, 'UNSORTED');
    await uploadPhoto(a, id, 'UNSORTED');
    const enough = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(enough.body).toMatchObject({ needed: 0, missing: [], ready: true });
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);

    const review = await admin
      .get(`/v1/admin/listings/${String(submitted.body.listing.id)}`)
      .expect(200);
    const items = review.body.submittedPhotos.items as { slot: string; downloadName: string }[];
    expect(items.map((item) => item.slot)).toEqual(['FRONT', ...Array(9).fill('UNSORTED')]);
    expect(items[1]?.downloadName).toMatch(/-02-photo\.jpg$/);
    expect(review.body.submittedPhotos.missing).toEqual([]);
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
    expect(detail.body.submittedPhotos.items[0].downloadName).toBe(
      '2023-hyundai-creta-sx-o-01-front-three-quarter-driver-side.jpg',
    );
    expect(detail.body.submittedPhotos.archiveName).toBe('2023-hyundai-creta-sx-o.zip');

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

describe('the edges of uploading', () => {
  beforeAll(async () => {
    await flag('feature.dealerPhotos', true);
  });

  async function dealerPlan(): Promise<string> {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    return id;
  }

  it('refuses an upload before the dealer chose to photograph the car', async () => {
    const id = await draft();
    const refused = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'FRONT', fileName: 'f.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(refused.body.code).toBe('PHOTO_PLAN_NOT_DEALER');
  });

  it('keeps the plan when it is chosen again', async () => {
    const id = await dealerPlan();
    const again = await a.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALER' })
      .expect(200);
    expect(again.body.plan).toBe('DEALER');
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'listing.photo_plan_set', after: { path: ['vehicleId'], equals: id } },
      }),
    ).toBe(1);
  });

  it('answers a second commit of the same upload with the same photographs', async () => {
    const id = await dealerPlan();
    const signed = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'FRONT', fileName: 'f.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(201);
    const url = new URL(String(signed.body.uploadUrl));
    await a.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    const commit = `/v1/dealer/vehicles/${id}/photos/${signed.body.mediaId}/commit`;
    await a.agent.post(commit).expect(200);
    const second = await a.agent.post(commit).expect(200);
    expect(second.body.slots[1].photo.mediaId).toBe(signed.body.mediaId);
  });

  it('refuses a file whose size is not what was declared', async () => {
    const id = await dealerPlan();
    const signed = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'FRONT', fileName: 'f.jpg', mimeType: 'image/jpeg', bytes: JPEG.length + 5 })
      .expect(201);
    const url = new URL(String(signed.body.uploadUrl));
    const put = await a.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG);
    if (put.status !== 200) return;
    const refused = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/${signed.body.mediaId}/commit`)
      .expect(422);
    expect(refused.body.code).toBe('UPLOAD_MISMATCH');
  });

  it('refuses to commit an upload that never arrived, or one for another car', async () => {
    const id = await dealerPlan();
    const other = await dealerPlan();
    const signed = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'REAR', fileName: 'r.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(201);
    const missing = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/${signed.body.mediaId}/commit`)
      .expect(422);
    expect(missing.body.code).toBe('UPLOAD_MISSING');
    const elsewhere = await a.agent
      .post(`/v1/dealer/vehicles/${other}/photos/${signed.body.mediaId}/commit`)
      .expect(404);
    expect(elsewhere.body.code).toBe('UPLOAD_NOT_FOUND');
  });

  it('takes up to six extras and removes one on request', async () => {
    const id = await dealerPlan();
    for (let index = 0; index < 6; index += 1) {
      expect((await uploadPhoto(a, id, 'EXTRA')).status).toBe(200);
    }
    const full = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'EXTRA', fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(full.body.code).toBe('PHOTO_EXTRAS_FULL');

    const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(photos.body.extras).toHaveLength(6);
    const removed = await a.agent
      .delete(`/v1/dealer/vehicles/${id}/photos/${photos.body.extras[0].mediaId}`)
      .expect(200);
    expect(removed.body.extras).toHaveLength(5);
  });

  it('takes up to sixteen photographs at once, without replacing one another', async () => {
    const id = await dealerPlan();
    for (let index = 0; index < 16; index += 1) {
      expect((await uploadPhoto(a, id, 'UNSORTED')).status).toBe(200);
    }
    const full = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'UNSORTED', fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(full.body.code).toBe('PHOTOS_FULL');
    const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(photos.body.unsorted).toHaveLength(16);
  });

  it('caps a car at sixteen photographs across both ways of uploading', async () => {
    const id = await dealerPlan();
    for (const slot of STANDARD_PHOTO_SLOTS) await uploadPhoto(a, id, slot);
    for (let index = 0; index < 6; index += 1) await uploadPhoto(a, id, 'UNSORTED');

    const full = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'UNSORTED', fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(full.body.code).toBe('PHOTOS_FULL');
    const extra = await a.agent
      .post(`/v1/dealer/vehicles/${id}/photos/presign`)
      .send({ slot: 'EXTRA', fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(extra.body.code).toBe('PHOTOS_FULL');

    expect((await uploadPhoto(a, id, 'DASHBOARD')).status).toBe(200);
    const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
    expect(photos.body.photosMax).toBe(16);
    expect(photos.body.unsorted).toHaveLength(6);
    expect(photos.body.slots.filter((slot: { photo: unknown }) => slot.photo)).toHaveLength(10);
  });

  it('answers a photograph that is not on the car as not found', async () => {
    const id = await dealerPlan();
    const missing = await a.agent
      .delete(`/v1/dealer/vehicles/${id}/photos/00000000-0000-4000-8000-000000000000`)
      .expect(404);
    expect(missing.body.code).toBe('PHOTO_NOT_FOUND');
  });

  it('offers no photoshoot to a dealership with no service district', async () => {
    const id = await draft();
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: a.dealerId } });
    await h.prisma.dealer.update({
      where: { id: a.dealerId },
      data: { serviceDistrictId: null, serviceStateId: null, district: null },
    });
    try {
      const photos = await a.agent.get(`/v1/dealer/vehicles/${id}/photos`).expect(200);
      expect(photos.body.photoshoot).toEqual({ available: false, district: null });
      const refused = await a.agent
        .put(`/v1/dealer/vehicles/${id}/photo-plan`)
        .send({ plan: 'DEALERS_DRIVE' })
        .expect(422);
      expect(refused.body.detail).toMatch(/your dealership’s location/);
    } finally {
      await h.prisma.dealer.update({
        where: { id: a.dealerId },
        data: {
          serviceDistrictId: dealer.serviceDistrictId,
          serviceStateId: dealer.serviceStateId,
          district: dealer.district,
        },
      });
    }
  });

  it('refuses a car submitted for a photoshoot after the district lost coverage', async () => {
    const id = await draft();
    await a.agent
      .put(`/v1/dealer/vehicles/${id}/photo-plan`)
      .send({ plan: 'DEALERS_DRIVE' })
      .expect(200);
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: a.dealerId } });
    await h.prisma.serviceDistrict.update({
      where: { id: dealer.serviceDistrictId ?? '' },
      data: { photographyAvailable: false },
    });
    try {
      const refused = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(422);
      expect(refused.body.code).toBe('PHOTOSHOOT_UNAVAILABLE');
    } finally {
      await h.prisma.serviceDistrict.update({
        where: { id: dealer.serviceDistrictId ?? '' },
        data: { photographyAvailable: true },
      });
    }
  });

  it('shows the review team nothing to download for a car with no plan', async () => {
    const id = await draft();
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    const detail = await admin.get(`/v1/admin/listings/${listing.id}`).expect(200);
    expect(detail.body.submittedPhotos).toEqual({
      plan: null,
      planLabel: null,
      archiveName: '2023-hyundai-creta-sx-o.zip',
      items: [],
      missing: [],
    });
  });
});

describe('downloading the dealer’s set for StudioCar', () => {
  beforeAll(async () => {
    await flag('feature.dealerPhotos', true);
  });

  async function submittedSet(extras = 0): Promise<{ listingId: string; vehicleId: string }> {
    const id = await draft();
    await a.agent.put(`/v1/dealer/vehicles/${id}/photo-plan`).send({ plan: 'DEALER' }).expect(200);
    await uploadAll(a, id);
    for (let index = 0; index < extras; index += 1) await uploadPhoto(a, id, 'EXTRA');
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    return { listingId: submitted.body.listing.id as string, vehicleId: id };
  }

  function fetchLink(url: string) {
    const link = new URL(url);
    return h
      .agent()
      .get(link.pathname + link.search)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
  }

  it('zips every photograph in shooting order, named for the car, and saves it as an attachment', async () => {
    const { listingId } = await submittedSet(1);
    const answer = await admin
      .post(`/v1/admin/listings/${listingId}/submitted-photos/download`)
      .send({})
      .expect(200);
    expect(answer.body).toMatchObject({
      fileName: '2023-hyundai-creta-sx-o.zip',
      expiresInSeconds: 300,
    });

    const zip = await fetchLink(answer.body.url as string).expect(200);
    expect(zip.headers['content-disposition']).toBe(
      'attachment; filename="2023-hyundai-creta-sx-o.zip"',
    );
    const entries = readZip(zip.body as Buffer);
    expect(entries.map((entry) => entry.name)).toEqual([
      '2023-hyundai-creta-sx-o-01-front-three-quarter-driver-side.jpg',
      '2023-hyundai-creta-sx-o-02-straight-front.jpg',
      '2023-hyundai-creta-sx-o-03-front-three-quarter-passenger-side.jpg',
      '2023-hyundai-creta-sx-o-04-side-profile-passenger-side.jpg',
      '2023-hyundai-creta-sx-o-05-straight-rear.jpg',
      '2023-hyundai-creta-sx-o-06-side-profile-driver-side.jpg',
      '2023-hyundai-creta-sx-o-07-front-seats.jpg',
      '2023-hyundai-creta-sx-o-08-rear-seats.jpg',
      '2023-hyundai-creta-sx-o-09-dashboard.jpg',
      '2023-hyundai-creta-sx-o-10-odometer.jpg',
      '2023-hyundai-creta-sx-o-11-extra-photograph.jpg',
    ]);
    expect(entries.every((entry) => entry.data.equals(JPEG))).toBe(true);

    const again = await admin
      .post(`/v1/admin/listings/${listingId}/submitted-photos/download`)
      .send({})
      .expect(200);
    expect(new URL(again.body.url as string).searchParams.get('key')).toBe(
      new URL(answer.body.url as string).searchParams.get('key'),
    );
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'listing.submitted_photos_downloaded', entityId: listingId },
      }),
    ).toBe(2);
  });

  it('downloads one photograph under its StudioCar name', async () => {
    const { listingId } = await submittedSet();
    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    const odometer = detail.body.submittedPhotos.items[9];
    const answer = await admin
      .post(`/v1/admin/listings/${listingId}/submitted-photos/download`)
      .send({ mediaId: odometer.mediaId })
      .expect(200);
    expect(answer.body.fileName).toBe('2023-hyundai-creta-sx-o-10-odometer.jpg');
    const photo = await fetchLink(answer.body.url as string).expect(200);
    expect(photo.headers['content-disposition']).toBe(
      'attachment; filename="2023-hyundai-creta-sx-o-10-odometer.jpg"',
    );
    expect((photo.body as Buffer).equals(JPEG)).toBe(true);
  });

  it('refuses a photograph that is not on the car, a car with none, and a dealer', async () => {
    const { listingId } = await submittedSet();
    const missing = await admin
      .post(`/v1/admin/listings/${listingId}/submitted-photos/download`)
      .send({ mediaId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
    expect(missing.body.code).toBe('PHOTO_NOT_FOUND');

    const bare = await draft();
    await a.agent
      .put(`/v1/dealer/vehicles/${bare}/photo-plan`)
      .send({ plan: 'DEALERS_DRIVE' })
      .expect(200);
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${bare}/submit`).expect(200);
    const none = await admin
      .post(`/v1/admin/listings/${submitted.body.listing.id}/submitted-photos/download`)
      .send({})
      .expect(422);
    expect(none.body.code).toBe('NO_SUBMITTED_PHOTOS');

    await admin
      .post('/v1/admin/listings/00000000-0000-4000-8000-000000000000/submitted-photos/download')
      .send({})
      .expect(404);
    await a.agent
      .post(`/v1/admin/listings/${listingId}/submitted-photos/download`)
      .send({})
      .expect(401);
  });
});
