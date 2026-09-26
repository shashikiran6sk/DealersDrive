import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Gallery order and the primary image (**F035** as reinterpreted by
 * **R45**): an admin's decision, deterministic, and one primary at most.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let plate = 8000;

interface Gallery {
  listingId: string;
  vehicleId: string;
  mediaIds: string[];
}

async function gallery(count: number): Promise<Gallery> {
  plate += 1;
  const created = await a.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `KL 09 OR ${String(plate)}` })
    .expect(201);
  const vehicleId = created.body.id as string;
  await a.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
  const done = await a.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
  const mediaIds = await seedImages(h.prisma, { vehicleId, dealerId: a.dealerId }, count);
  return { listingId: done.body.listing.id as string, vehicleId, mediaIds };
}

interface Item {
  mediaId: string;
  position: number;
  isPrimary: boolean;
}

function shape(items: Item[]): [string, number, boolean][] {
  return items.map((item) => [item.mediaId, item.position, item.isPrimary]);
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'image-order');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

describe('reordering', () => {
  it('puts the images in the order given and leaves the primary where it was', async () => {
    const { listingId, vehicleId, mediaIds } = await gallery(3);
    const [first, second, third] = mediaIds as [string, string, string];

    const response = await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds: [third, first, second] })
      .expect(200);

    expect(shape(response.body.items)).toEqual([
      [third, 0, false],
      [first, 1, true],
      [second, 2, false],
    ]);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: vehicleId, action: 'vehicle.images_reordered' },
    });
    expect(audit.before).toEqual({ mediaIds: [first, second, third] });
    expect(audit.after).toMatchObject({ mediaIds: [third, first, second] });
  });

  it('shows the same order on the review screen afterwards', async () => {
    const { listingId, mediaIds } = await gallery(2);
    const reversed = [...mediaIds].reverse();
    await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds: reversed })
      .expect(200);

    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.images.items.map((item: Item) => item.mediaId)).toEqual(reversed);
  });

  it.each([
    ['omits an image', (ids: string[]) => ids.slice(1)],
    ['adds an image from nowhere', (ids: string[]) => [...ids, crypto.randomUUID()]],
    ['swaps in a stranger', (ids: string[]) => [...ids.slice(1), crypto.randomUUID()]],
  ])('refuses an order that %s, and moves nothing', async (_label, change) => {
    const { listingId, mediaIds } = await gallery(3);

    const refused = await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds: change(mediaIds) })
      .expect(422);
    expect(refused.body.code).toBe('IMAGE_ORDER_MISMATCH');

    const detail = await admin.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.images.items.map((item: Item) => item.mediaId)).toEqual(mediaIds);
  });

  it("refuses another vehicle's images, even all of them", async () => {
    const one = await gallery(2);
    const other = await gallery(2);

    await admin
      .put(`/v1/admin/listings/${one.listingId}/images/order`)
      .send({ mediaIds: other.mediaIds })
      .expect(422);
  });

  it('refuses a repeated image and an empty order at the boundary', async () => {
    const { listingId, mediaIds } = await gallery(2);
    const [first] = mediaIds as [string];

    await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds: [first, first] })
      .expect(400);
    await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds: [] })
      .expect(400);
    await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds, position: 0 })
      .expect(400);
  });

  it('keeps positions unique when two reorders race', async () => {
    const { listingId, vehicleId, mediaIds } = await gallery(4);
    const reversed = [...mediaIds].reverse();
    const rotated = [...mediaIds.slice(1), mediaIds[0]!];

    const results = await Promise.all([
      admin.put(`/v1/admin/listings/${listingId}/images/order`).send({ mediaIds: reversed }),
      admin.put(`/v1/admin/listings/${listingId}/images/order`).send({ mediaIds: rotated }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);

    const rows = await h.prisma.vehicleMedia.findMany({
      where: { vehicleId },
      orderBy: { position: 'asc' },
    });
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2, 3]);
    const final = rows.map((row) => row.mediaId);
    expect([reversed, rotated]).toContainEqual(final);
  });
});

describe('the primary image', () => {
  it('moves the primary to the chosen image and clears the old one', async () => {
    const { listingId, vehicleId, mediaIds } = await gallery(3);
    const [first, , third] = mediaIds as [string, string, string];

    const response = await admin
      .put(`/v1/admin/listings/${listingId}/images/${third}/primary`)
      .expect(200);
    expect(
      response.body.items.filter((item: Item) => item.isPrimary).map((item: Item) => item.mediaId),
    ).toEqual([third]);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: vehicleId, action: 'vehicle.image_primary_set' },
    });
    expect(audit.before).toEqual({ mediaId: first });
    expect(audit.after).toMatchObject({ mediaId: third });
  });

  it('changes nothing, and audits nothing, when the image is already primary', async () => {
    const { listingId, vehicleId, mediaIds } = await gallery(2);

    await admin.put(`/v1/admin/listings/${listingId}/images/${mediaIds[0]!}/primary`).expect(200);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: vehicleId, action: 'vehicle.image_primary_set' },
      }),
    ).toBe(0);
  });

  it('keeps exactly one primary when two choices race', async () => {
    const { listingId, vehicleId, mediaIds } = await gallery(3);

    const results = await Promise.all([
      admin.put(`/v1/admin/listings/${listingId}/images/${mediaIds[1]!}/primary`),
      admin.put(`/v1/admin/listings/${listingId}/images/${mediaIds[2]!}/primary`),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await h.prisma.vehicleMedia.count({ where: { vehicleId, isPrimary: true } })).toBe(1);
  });

  it("answers 404 for another vehicle's image", async () => {
    const one = await gallery(1);
    const other = await gallery(1);

    const refused = await admin
      .put(`/v1/admin/listings/${one.listingId}/images/${other.mediaIds[0]!}/primary`)
      .expect(404);
    expect(refused.body.code).toBe('IMAGE_NOT_FOUND');
  });

  it('is refused by the database, not only by the service, as a second primary', async () => {
    const { vehicleId, mediaIds } = await gallery(2);

    await expect(
      h.prisma.vehicleMedia.update({
        where: { mediaId: mediaIds[1]! },
        data: { isPrimary: true },
      }),
    ).rejects.toThrow();
    expect(await h.prisma.vehicleMedia.count({ where: { vehicleId, isPrimary: true } })).toBe(1);
  });
});

describe('when the gallery is closed', () => {
  it('refuses reorder and primary once the listing is out of review', async () => {
    const { listingId, mediaIds } = await gallery(2);
    await admin
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'Not a car we can list.' })
      .expect(200);

    const order = await admin
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds: [...mediaIds].reverse() })
      .expect(409);
    expect(order.body.code).toBe('IMAGES_CLOSED');
    await admin.put(`/v1/admin/listings/${listingId}/images/${mediaIds[1]!}/primary`).expect(409);
  });

  it('refuses a dealer session', async () => {
    const { listingId, mediaIds } = await gallery(2);
    await a.agent
      .put(`/v1/admin/listings/${listingId}/images/order`)
      .send({ mediaIds })
      .expect(401);
    await a.agent.put(`/v1/admin/listings/${listingId}/images/${mediaIds[0]!}/primary`).expect(401);
  });
});
