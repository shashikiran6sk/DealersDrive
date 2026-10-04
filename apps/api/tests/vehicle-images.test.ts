import { JPEG, PNG } from './image-fixture.js';
import { VEHICLE_IMAGE_MAX } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Vehicle images (**R45**): uploaded by an admin, never by a dealer, into a
 * key the server chooses, verified by their bytes, and public only once the
 * listing is.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let b: Dealership;
let plate = 7000;

const NOT_AN_IMAGE = Buffer.from('#!/bin/sh\necho definitely a jpeg\n');

interface Submitted {
  vehicleId: string;
  listingId: string;
}

async function submitted(owner: Dealership = a): Promise<Submitted> {
  plate += 1;
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `KL 08 IM ${String(plate)}` })
    .expect(201);
  await owner.agent
    .patch(`/v1/dealer/vehicles/${created.body.id}`)
    .send(COMPLETE_VEHICLE)
    .expect(200);
  const done = await owner.agent.post(`/v1/dealer/vehicles/${created.body.id}/submit`).expect(200);
  return { vehicleId: created.body.id as string, listingId: done.body.listing.id as string };
}

async function presign(
  listingId: string,
  body: Buffer,
  mimeType = 'image/jpeg',
): Promise<{ mediaId: string; uploadUrl: string }> {
  const response = await admin
    .post(`/v1/admin/listings/${listingId}/images/presign`)
    .send({ fileName: 'front.jpg', mimeType, bytes: body.length })
    .expect(201);
  return response.body as { mediaId: string; uploadUrl: string };
}

async function put(uploadUrl: string, body: Buffer, mimeType = 'image/jpeg'): Promise<void> {
  const url = new URL(uploadUrl);
  await admin
    .put(url.pathname + url.search)
    .set('Content-Type', mimeType)
    .send(body)
    .expect(200);
}

async function upload(
  listingId: string,
  body: Buffer = JPEG,
  mimeType = 'image/jpeg',
): Promise<request.Response> {
  const signed = await presign(listingId, body, mimeType);
  await put(signed.uploadUrl, body, mimeType);
  return admin.post(`/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`).expect(200);
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'images');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

describe('uploading an image', () => {
  it('stores it at a key the server chose, appends it, and makes the first one primary', async () => {
    const { listingId, vehicleId } = await submitted();

    const signed = await presign(listingId, JPEG);
    const media = await h.prisma.media.findUniqueOrThrow({ where: { id: signed.mediaId } });
    expect(media).toMatchObject({
      ownerType: 'VEHICLE',
      uploadedByAdmin: true,
      status: 'PENDING',
      dealerId: a.dealerId,
      storageKey: `vehicles/${vehicleId}/${signed.mediaId}/original.jpg`,
    });

    await put(signed.uploadUrl, JPEG);
    const first = await admin
      .post(`/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`)
      .expect(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body).toMatchObject({ min: 6, max: VEHICLE_IMAGE_MAX, canEdit: true });
    expect(first.body.items).toEqual([
      expect.objectContaining({
        mediaId: signed.mediaId,
        position: 0,
        isPrimary: true,
        mimeType: 'image/jpeg',
        bytes: JPEG.length,
        fileName: 'front.jpg',
      }),
    ]);

    const second = await upload(listingId, PNG, 'image/png');
    expect(
      second.body.items.map((item: { position: number; isPrimary: boolean }) => [
        item.position,
        item.isPrimary,
      ]),
    ).toEqual([
      [0, true],
      [1, false],
    ]);

    const audits = await h.prisma.auditLog.findMany({
      where: { entityId: vehicleId, action: 'vehicle.image_added' },
    });
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({ actorType: 'ADMIN', entityType: 'Vehicle' });
  });

  it('shows the images on the review screen and the count in the queue', async () => {
    const { listingId, vehicleId } = await submitted();
    await upload(listingId);

    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.images.items).toHaveLength(1);
    expect(detail.body.images.items[0].url).toContain('/private?');

    const preview = new URL(detail.body.images.items[0].url as string);
    const bytes = await admin.get(preview.pathname + preview.search).expect(200);
    expect(bytes.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(bytes.body as Buffer).equals(JPEG)).toBe(true);

    const queue = await admin.get('/v1/admin/listings?q=KL08IM').expect(200);
    const row = queue.body.data.find(
      (entry: { vehicleId: string }) => entry.vehicleId === vehicleId,
    );
    expect(row.imageCount).toBe(1);
  });

  it('commits idempotently', async () => {
    const { listingId } = await submitted();
    const signed = await presign(listingId, JPEG);
    await put(signed.uploadUrl, JPEG);
    const commit = `/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`;

    await admin.post(commit).expect(200);
    const again = await admin.post(commit).expect(200);
    expect(again.body.items).toHaveLength(1);
  });

  it('attaches each image once when two commits race', async () => {
    const { listingId, vehicleId } = await submitted();
    const signed = await presign(listingId, JPEG);
    await put(signed.uploadUrl, JPEG);
    const commit = `/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`;

    const results = await Promise.all([admin.post(commit), admin.post(commit)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await h.prisma.vehicleMedia.count({ where: { vehicleId } })).toBe(1);
  });
});

describe('what an upload must be', () => {
  it('refuses a file whose bytes are not the image it claimed to be, and deletes it', async () => {
    const { listingId, vehicleId } = await submitted();
    const signed = await presign(listingId, NOT_AN_IMAGE);
    await put(signed.uploadUrl, NOT_AN_IMAGE);

    const refused = await admin
      .post(`/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`)
      .expect(422);
    expect(refused.body.code).toBe('UPLOAD_NOT_IMAGE');

    const media = await h.prisma.media.findUniqueOrThrow({ where: { id: signed.mediaId } });
    expect(media.status).toBe('FAILED');
    expect(await h.prisma.vehicleMedia.count({ where: { vehicleId } })).toBe(0);
  });

  it('refuses a PNG declared as a JPEG', async () => {
    const { listingId } = await submitted();
    const signed = await presign(listingId, PNG, 'image/jpeg');
    await put(signed.uploadUrl, PNG, 'image/jpeg');

    const refused = await admin
      .post(`/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`)
      .expect(422);
    expect(refused.body.code).toBe('UPLOAD_NOT_IMAGE');
  });

  it('refuses a commit before anything was uploaded', async () => {
    const { listingId } = await submitted();
    const signed = await presign(listingId, JPEG);

    const refused = await admin
      .post(`/v1/admin/listings/${listingId}/images/${signed.mediaId}/commit`)
      .expect(422);
    expect(refused.body.code).toBe('UPLOAD_MISSING');
  });

  it.each([
    ['a type that is not an image', { fileName: 'x.gif', mimeType: 'image/gif', bytes: 10 }],
    ['a file over 10 MB', { fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 10_485_761 }],
    [
      'a client-chosen storage key',
      { fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 10, storageKey: 'vehicles/other/x' },
    ],
    [
      'a client-chosen vehicle',
      { fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 10, vehicleId: crypto.randomUUID() },
    ],
  ])('refuses %s at presign', async (_label, body) => {
    const { listingId } = await submitted();
    await admin.post(`/v1/admin/listings/${listingId}/images/presign`).send(body).expect(400);
  });

  it("will not attach an upload made for another listing's vehicle", async () => {
    const one = await submitted();
    const other = await submitted(b);
    const signed = await presign(one.listingId, JPEG);
    await put(signed.uploadUrl, JPEG);

    const refused = await admin
      .post(`/v1/admin/listings/${other.listingId}/images/${signed.mediaId}/commit`)
      .expect(404);
    expect(refused.body.code).toBe('UPLOAD_NOT_FOUND');
    expect(await h.prisma.vehicleMedia.count({ where: { vehicleId: other.vehicleId } })).toBe(0);
  });

  it('will not attach a yard photograph as a vehicle image', async () => {
    const { listingId } = await submitted();
    const yard = await a.agent
      .post('/v1/dealer/yard-photo/presign')
      .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(201);

    await admin
      .post(`/v1/admin/listings/${listingId}/images/${yard.body.mediaId}/commit`)
      .expect(404);
  });

  it(`stops at ${String(VEHICLE_IMAGE_MAX)} images`, async () => {
    const { listingId, vehicleId } = await submitted();
    const media = await h.prisma.media.createManyAndReturn({
      data: Array.from({ length: VEHICLE_IMAGE_MAX }, (_, index) => ({
        dealerId: a.dealerId,
        ownerType: 'VEHICLE' as const,
        storageKey: `vehicles/${vehicleId}/seed-${String(index)}/original.jpg`,
        mimeType: 'image/jpeg',
        bytes: 1,
        uploadedByAdmin: true,
        status: 'READY' as const,
      })),
    });
    const moderator = await h.prisma.user.findFirstOrThrow({
      where: { email: env.adminAllowlist[0] ?? '' },
    });
    await h.prisma.vehicleMedia.createMany({
      data: media.map((row, position) => ({
        vehicleId,
        mediaId: row.id,
        position,
        isPrimary: position === 0,
        addedBy: moderator.id,
      })),
    });

    const refused = await admin
      .post(`/v1/admin/listings/${listingId}/images/presign`)
      .send({ fileName: 'one-more.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(refused.body.code).toBe('VEHICLE_IMAGES_FULL');
  });
});

describe('removing an image', () => {
  it('closes the gap and promotes the next image when the primary goes', async () => {
    const { listingId, vehicleId } = await submitted();
    await upload(listingId);
    await upload(listingId);
    const last = await upload(listingId);
    const [first, second, third] = last.body.items as { mediaId: string }[];

    const after = await admin
      .delete(`/v1/admin/listings/${listingId}/images/${first!.mediaId}`)
      .expect(200);
    expect(
      after.body.items.map((item: { mediaId: string; position: number; isPrimary: boolean }) => [
        item.mediaId,
        item.position,
        item.isPrimary,
      ]),
    ).toEqual([
      [second!.mediaId, 0, true],
      [third!.mediaId, 1, false],
    ]);

    const removed = await h.prisma.media.findUniqueOrThrow({ where: { id: first!.mediaId } });
    expect(removed.status).toBe('ORPHAN');
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: vehicleId, action: 'vehicle.image_removed' },
    });
    expect(audit.after).toMatchObject({ primaryMediaId: second!.mediaId });
  });

  it('closes the gap in the middle without moving the primary', async () => {
    const { listingId } = await submitted();
    await upload(listingId);
    await upload(listingId);
    const last = await upload(listingId);
    const [first, second, third] = last.body.items as { mediaId: string }[];

    const after = await admin
      .delete(`/v1/admin/listings/${listingId}/images/${second!.mediaId}`)
      .expect(200);
    expect(
      after.body.items.map((item: { mediaId: string; position: number; isPrimary: boolean }) => [
        item.mediaId,
        item.position,
        item.isPrimary,
      ]),
    ).toEqual([
      [first!.mediaId, 0, true],
      [third!.mediaId, 1, false],
    ]);
  });

  it('answers 404 for an image on another vehicle', async () => {
    const one = await submitted();
    const other = await submitted();
    const uploaded = await upload(one.listingId);

    const refused = await admin
      .delete(`/v1/admin/listings/${other.listingId}/images/${uploaded.body.items[0].mediaId}`)
      .expect(404);
    expect(refused.body.code).toBe('IMAGE_NOT_FOUND');
  });
});

describe('when images may change', () => {
  it('refuses every change once the listing is out of review', async () => {
    const { listingId } = await submitted();
    const uploaded = await upload(listingId);
    await admin
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'Not a car we can list.' })
      .expect(200);

    const presigned = await admin
      .post(`/v1/admin/listings/${listingId}/images/presign`)
      .send({ fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
    expect(presigned.body).toMatchObject({ code: 'IMAGES_CLOSED', listingStatus: 'REJECTED' });

    await admin
      .delete(`/v1/admin/listings/${listingId}/images/${uploaded.body.items[0].mediaId}`)
      .expect(409);

    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.images.canEdit).toBe(false);
  });

  it('allows changes while the dealer is making requested changes', async () => {
    const { listingId } = await submitted();
    await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Please correct the odometer reading.' })
      .expect(200);

    await upload(listingId);
  });

  it('refuses a draft that was never submitted', async () => {
    plate += 1;
    const created = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: `KL 08 IM ${String(plate)}` })
      .expect(201);
    const listing = await h.prisma.listing.findUniqueOrThrow({
      where: { vehicleId: created.body.id as string },
    });

    await admin
      .post(`/v1/admin/listings/${listing.id}/images/presign`)
      .send({ fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(409);
  });
});

describe('who may upload', () => {
  it('has no dealer route to write vehicle media', async () => {
    const { vehicleId } = await submitted();
    await a.agent
      .post('/v1/dealer/media/presign')
      .send({
        ownerType: 'VEHICLE',
        ownerId: vehicleId,
        fileName: 'x.jpg',
        mimeType: 'image/jpeg',
        bytes: 10,
      })
      .expect(404);
  });

  it('refuses a dealer session on the admin routes', async () => {
    const { listingId } = await submitted();
    await a.agent
      .post(`/v1/admin/listings/${listingId}/images/presign`)
      .send({ fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 10 })
      .expect(401);
  });

  it('refuses an admin without the upload permission', async () => {
    const { listingId } = await submitted();
    const email = env.adminAllowlist[0] ?? '';
    await h.prisma.user.updateMany({ where: { email }, data: { adminRole: 'SUPPORT' } });
    try {
      const refused = await admin
        .post(`/v1/admin/listings/${listingId}/images/presign`)
        .send({ fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 10 })
        .expect(403);
      expect(refused.body.detail).toContain('admin:media:upload');
    } finally {
      await h.prisma.user.updateMany({ where: { email }, data: { adminRole: 'SUPER_ADMIN' } });
    }
  });

  it('answers 404 for a listing that does not exist', async () => {
    await admin
      .post(`/v1/admin/listings/${crypto.randomUUID()}/images/presign`)
      .send({ fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 10 })
      .expect(404);
  });
});

describe('who may see an image', () => {
  it('serves a vehicle image publicly only while its listing is ACTIVE', async () => {
    const { listingId } = await submitted();
    const uploaded = await upload(listingId);
    const path = `/media/by-media/${uploaded.body.items[0].mediaId as string}/640.webp`;

    await h.agent().get(path).expect(404);

    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
    const served = await h.agent().get(path).expect(200);
    expect(served.headers['content-type']).toContain('image/webp');
    expect(
      Buffer.from(served.body as Buffer)
        .subarray(8, 12)
        .toString(),
    ).toBe('WEBP');

    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'WITHDRAWN' } });
    await h.agent().get(path).expect(404);
  });

  it('refuses a signed preview whose signature was altered', async () => {
    const { listingId } = await submitted();
    const uploaded = await upload(listingId);
    const preview = new URL(uploaded.body.items[0].url as string);
    preview.searchParams.set('signature', '0'.repeat(64));

    await h
      .agent()
      .get(preview.pathname + preview.search)
      .expect(404);
  });

  it('refuses a signed preview for a different key', async () => {
    const { listingId } = await submitted();
    const uploaded = await upload(listingId);
    const preview = new URL(uploaded.body.items[0].url as string);
    preview.searchParams.set('key', 'dealers/someone-else/kyc/pan.pdf');

    await h
      .agent()
      .get(preview.pathname + preview.search)
      .expect(404);
  });
});
