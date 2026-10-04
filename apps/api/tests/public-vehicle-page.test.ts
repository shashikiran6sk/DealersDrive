import { JPEG } from './image-fixture.js';
import { PublicVehicleDetail } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * One vehicle's public page (**F082** as scoped by **R45**): an ACTIVE
 * listing of an ACTIVE dealership, and a 404 for everything else.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let live: Published;
let plate = 200;

function nextPlate(): string {
  plate += 1;
  return `TN 23 VD ${String(plate).padStart(4, '0')}`;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'vehicle-page');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);
  live = await kit.published(a, nextPlate());
});

afterAll(async () => {
  await h.close();
});

describe('an approved car', () => {
  it('has a public page with its specifications, gallery and dealership', async () => {
    const response = await h.agent().get(`/v1/vehicles/${live.slug}`).expect(200);
    const body = PublicVehicleDetail.parse(response.body);

    expect(body).toMatchObject({
      slug: live.slug,
      title: '2023 Hyundai Creta SX(O)',
      year: 2023,
      priceLabel: '₹14,50,000',
      negotiabilityLabel: expect.any(String),
      description: 'Single owner.',
      primaryIndex: 0,
      publishedLabel: expect.stringMatching(/^Listed /),
      dealer: { slug: a.slug, isVerified: true },
    });
    expect(body.specs).toContainEqual({ label: 'Registered at', value: 'TN 23' });
    expect(body.specs).toContainEqual({ label: 'Kilometres driven', value: '22,400 km' });
    expect(body.images).toHaveLength(6);
    expect(body.images[0]?.url).toContain(`/by-media/${live.mediaIds[0]!}/1024.webp`);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('shows the gallery in the order the admin set, with the primary marked', async () => {
    const other = await kit.published(a, nextPlate());
    await h.prisma.listing.update({
      where: { id: other.listingId },
      data: { status: 'PENDING_REVIEW' },
    });
    const reversed = [...other.mediaIds].reverse();
    await admin
      .put(`/v1/admin/listings/${other.listingId}/images/order`)
      .send({ mediaIds: reversed })
      .expect(200);
    await admin
      .put(`/v1/admin/listings/${other.listingId}/images/${other.mediaIds[2]!}/primary`)
      .expect(200);
    await h.prisma.listing.update({ where: { id: other.listingId }, data: { status: 'ACTIVE' } });

    const { body } = await h.agent().get(`/v1/vehicles/${other.slug}`).expect(200);
    expect(body.images.map((image: { url: string }) => image.url)).toEqual(
      reversed.map((mediaId) => expect.stringContaining(`/by-media/${mediaId}/`)),
    );
    expect(body.primaryIndex).toBe(reversed.indexOf(other.mediaIds[2]!));
  });

  it('never carries an id, the full registration, a moderation field, a key or a phone number', async () => {
    const { body } = await h.agent().get(`/v1/vehicles/${live.slug}`).expect(200);
    const text = JSON.stringify(body);

    expect(Object.keys(body).sort()).toEqual(
      [
        'availability',
        'dealer',
        'description',
        'facts',
        'images',
        'negotiabilityLabel',
        'primaryIndex',
        'priceLabel',
        'publishedLabel',
        'slug',
        'specs',
        'summary',
        'title',
        'year',
      ].sort(),
    );
    expect(Object.keys(body.dealer).sort()).toEqual(
      ['city', 'district', 'initials', 'isVerified', 'location', 'name', 'slug', 'state'].sort(),
    );
    expect(text).not.toContain(live.listingId);
    expect(text).not.toContain(live.vehicleId);
    expect(text).not.toContain(a.dealerId);
    expect(text).not.toMatch(/TN23VD|TN 23 VD/);
    expect(text).not.toMatch(/vehicles\/|storageKey|bucket|decision|audit|photography|check/i);
    expect(text).not.toMatch(/\+91|98400/);
  });
});

describe('everything else is a 404', () => {
  it.each([
    'DRAFT',
    'PENDING_REVIEW',
    'CHANGES_REQUESTED',
    'REJECTED',
    'SOLD',
    'WITHDRAWN',
  ] as const)(
    'answers 404 for a listing that is %s, exactly as for one that never existed',
    async (status) => {
      const hidden = await kit.published(a, nextPlate());
      await h.prisma.listing.update({ where: { id: hidden.listingId }, data: { status } });

      const refused = await h.agent().get(`/v1/vehicles/${hidden.slug}`).expect(404);
      const unknown = await h.agent().get('/v1/vehicles/never-existed-0000').expect(404);
      expect(refused.body.code).toBe('VEHICLE_NOT_FOUND');
      expect(refused.body.detail).toBe(unknown.body.detail);
      expect(JSON.stringify(refused.body)).not.toMatch(new RegExp(status, 'i'));
    },
  );

  it('answers 404 for a car of a dealership that is no longer active', async () => {
    const hidden = await kit.published(a, nextPlate());
    await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'SUSPENDED' } });
    try {
      await h.agent().get(`/v1/vehicles/${hidden.slug}`).expect(404);
    } finally {
      await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'ACTIVE' } });
    }
  });

  it('cannot be reached by listing or vehicle id', async () => {
    await h.agent().get(`/v1/vehicles/${live.listingId}`).expect(404);
    await h.agent().get(`/v1/vehicles/${live.vehicleId}`).expect(404);
  });

  it('refuses a slug with characters no slug has', async () => {
    await h.agent().get('/v1/vehicles/Not%20A%20Slug').expect(400);
  });

  it('stops serving the images once the car is taken down', async () => {
    const car = await kit.published(a, nextPlate());
    const media = await h.prisma.media.findUniqueOrThrow({ where: { id: car.mediaIds[0]! } });
    const { createLocalStorage } = await import('../src/platform/storage/local.adapter.js');
    await createLocalStorage().put(media.storageKey, JPEG, 'image/jpeg');
    const path = `/media/by-media/${car.mediaIds[0]!}/1024.webp`;

    await h.agent().get(path).expect(200);
    await h.prisma.listing.update({ where: { id: car.listingId }, data: { status: 'WITHDRAWN' } });
    await h.agent().get(path).expect(404);
    await h.agent().get(`/v1/vehicles/${car.slug}`).expect(404);
  });
});
