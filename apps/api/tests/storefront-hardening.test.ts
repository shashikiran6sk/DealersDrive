import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ListingCheckKey } from '@dealers-drive/contracts';
import { env } from '../src/config/env.js';
import { createStorefrontMediaCleanup } from '../src/modules/storefront/storefront.facade.js';
import { createVehicleDerivativeWorker } from '../src/modules/media/media.derivatives.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import {
  createAuthHarness,
  createFakeGoogle,
  createRecordingMailer,
  type AuthHarness,
} from './auth-harness.js';
import { marketplaceFixtures, COMPLETE_VEHICLE, type Dealership } from './marketplace-fixtures.js';

const SECRET = 'hardening-storefront-synthetic-secret-32-characters';
const stamp = randomUUID().slice(0, 8);
let h: AuthHarness;
let owner: Dealership;
let other: Dealership;
let admin: ReturnType<AuthHarness['agent']>;
let buyer: ReturnType<AuthHarness['agent']>;
let customerId: string;
let host: string;
let slug: string;
let vehicleId: string;
let listingId: string;
let firstMedia: string;
function get(path: string, hostname = host) {
  return h
    .agent()
    .get(`/v1/storefront${path}`)
    .set('x-dd-storefront-host', hostname)
    .set('x-dd-storefront-secret', SECRET);
}
async function ticket() {
  const res = await h
    .agent()
    .post('/v1/storefront/enquiry-intent')
    .set('x-dd-storefront-host', host)
    .set('x-dd-storefront-secret', SECRET)
    .send({ listingSlug: slug })
    .expect(200);
  return new URL(res.body.url as string).searchParams.get('ticket')!;
}
async function observedWait(observer: Client, holderPid: number, fragment: string) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND query ILIKE $2 AND $1::int = ANY(pg_blocking_pids(pid))`,
      [holderPid, `%${fragment}%`],
    );
    if ((result.rowCount ?? 0) > 0) return;
    await pause(10);
  }
  throw new Error('The expected real queued write was not observed.');
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle(), createRecordingMailer(), {
    STOREFRONT_ENABLED: true,
    STOREFRONT_DEFAULT_DOMAIN_READY: true,
    STOREFRONT_SERVICE_SECRET: SECRET,
  });
  const fixtures = marketplaceFixtures(h, `white-label-journey-${stamp}`);
  owner = await fixtures.dealership();
  other = await fixtures.dealership();
  admin = await fixtures.moderator();
  host = `journey-${stamp}.dealers-drive.com`;
  await owner.agent
    .post('/v1/dealer/storefront')
    .send({ subdomain: `journey-${stamp}`, theme: 'LIGHT' })
    .expect(201);
  buyer = h.agent();
  const phone = '9840044441';
  const proof = await buyer
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:journey-${stamp}` })
    .expect(200);
  const created = await buyer
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proof.body.signUpToken, fullName: 'Synthetic Journey Buyer' })
    .expect(201);
  customerId = created.body.customer.id as string;
});
afterAll(async () => {
  await h.close();
});

describe('complete HTTP dealership website and moderated inventory journey', () => {
  it('previews draft, activates, persists Light-to-Dark and retains authoritative inventory', async () => {
    await get('/site').expect(404);
    await owner.agent.get('/v1/dealer/storefront/preview').expect(200);
    await owner.agent.put('/v1/dealer/storefront/enabled').send({ enabled: true }).expect(200);
    expect((await get('/site').expect(200)).body.theme).toBe('LIGHT');
    await owner.agent
      .patch('/v1/dealer/storefront')
      .send({
        theme: 'DARK',
        displayName: 'Journey Motors',
        headline: 'Synthetic inventory journey',
      })
      .expect(200);
    expect((await get('/site').expect(200)).body.theme).toBe('DARK');
    expect((await get('/site').expect(200)).body.theme).toBe('DARK');
    expect((await get('/cars').expect(200)).body.data).toEqual([]);
  });
  it('creates/submits/uploads/moderates through existing API before publishing approved photos', async () => {
    const created = await owner.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'TN99WE8601' })
      .expect(201);
    vehicleId = created.body.id as string;
    await owner.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
    const submitted = await owner.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
    listingId = submitted.body.listing.id as string;
    expect((await get('/cars')).body.data).toEqual([]);
    const png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#155e75' },
    })
      .png()
      .toBuffer();
    for (let index = 0; index < 6; index += 1) {
      const presigned = await admin
        .post(`/v1/admin/listings/${listingId}/images/presign`)
        .send({ fileName: `synthetic-${index}.png`, mimeType: 'image/png', bytes: png.length })
        .expect(201);
      const url = new URL(presigned.body.uploadUrl as string);
      await admin
        .put(url.pathname + url.search)
        .set('Content-Type', 'image/png')
        .send(png)
        .expect(200);
      await admin
        .post(`/v1/admin/listings/${listingId}/images/${presigned.body.mediaId}/commit`)
        .expect(200);
      if (index === 0) firstMedia = presigned.body.mediaId as string;
    }
    await h.agent().get(`/media/by-media/${firstMedia}/640.webp`).expect(404);
    for (const key of ListingCheckKey.options)
      await admin
        .put(`/v1/admin/listings/${listingId}/checks/${key}`)
        .send({ checked: true })
        .expect(200);
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
    slug = (await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).slug!;
    expect(
      (await get('/cars').expect(200)).body.data.map((row: { slug: string }) => row.slug),
    ).toEqual([slug]);
    expect((await get(`/cars/${slug}`).expect(200)).body.images).toHaveLength(6);
    await createVehicleDerivativeWorker(h.prisma, createLocalStorage())(firstMedia);
    expect(
      Object.keys(
        (await h.prisma.media.findUniqueOrThrow({ where: { id: firstMedia } })).variants as Record<
          string,
          string
        >,
      ),
    ).toHaveLength(4);
    await h.agent().get(`/media/by-media/${firstMedia}/640.webp`).expect(200);
  });
  it('routes a verified consented lead to only this dealer and admin with source attribution', async () => {
    const receipt = await buyer
      .post('/v1/enquiries/storefront')
      .send({ ticket: await ticket(), consent: true, message: 'Synthetic end-to-end enquiry' })
      .expect(201);
    await buyer.put(`/v1/saved-vehicles/${slug}`).expect(200);
    const id = receipt.body.id as string;
    expect(
      (await owner.agent.get('/v1/dealer/enquiries')).body.data.some(
        (row: { id: string; source: string }) => row.id === id && row.source === 'DEALER_WEBSITE',
      ),
    ).toBe(true);
    expect(
      (await other.agent.get('/v1/dealer/enquiries')).body.data.some(
        (row: { id: string }) => row.id === id,
      ),
    ).toBe(false);
    expect((await admin.get(`/v1/admin/enquiries/${id}`).expect(200)).body).toMatchObject({
      source: 'DEALER_WEBSITE',
      storefrontHostname: host,
    });
    await h.drainEmails();
    expect(
      await h.prisma.notificationDelivery.count({
        where: { dealerId: owner.dealerId, template: 'dealer.enquiry.received', status: 'SENT' },
      }),
    ).toBeGreaterThan(0);
    await buyer
      .post('/v1/enquiries/storefront')
      .send({ ticket: await ticket(), consent: true })
      .expect(409);
  });
  it('removes stale marketplace navigation and image access when destinations change', async () => {
    await owner.agent
      .put(`/v1/dealer/storefront/publication/${listingId}`)
      .send({ marketplacePublished: false, storefrontPublished: true })
      .expect(204);
    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);
    await get(`/cars/${slug}`).expect(200);
    const saved = await buyer.get('/v1/saved-vehicles').expect(200);
    expect(
      saved.body.data.find((row: { vehicle: { slug: string } }) => row.vehicle.slug === slug)
        .vehicle,
    ).toMatchObject({ availability: 'UNAVAILABLE', image: null });
    expect((await owner.agent.get('/v1/dealer/enquiries')).body.data[0].vehicle.href).toBeNull();
    await owner.agent
      .put(`/v1/dealer/storefront/publication/${listingId}`)
      .send({ marketplacePublished: false, storefrontPublished: false })
      .expect(204);
    await get(`/cars/${slug}`).expect(404);
    await h.agent().get(`/media/by-media/${firstMedia}/640.webp`).expect(404);
    await owner.agent
      .put(`/v1/dealer/storefront/publication/${listingId}`)
      .send({ marketplacePublished: true, storefrontPublished: true })
      .expect(204);
  });
  it('rejects a queued owner mutation after membership revocation before commit', async () => {
    const holder = new Client({ connectionString: env.DATABASE_URL });
    const observer = new Client({ connectionString: env.DATABASE_URL });
    await holder.connect();
    await observer.connect();
    await holder.query('BEGIN');
    const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await holder.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `storefront:${owner.dealerId}`,
    ]);
    let pending: Promise<{ status: number }> | undefined;
    try {
      pending = owner.agent
        .patch('/v1/dealer/storefront')
        .send({ theme: 'LIGHT' })
        .then((res) => res);
      await observedWait(observer, pid, 'advisory');
      await h.prisma.dealerMember.updateMany({
        where: { dealerId: owner.dealerId, userId: owner.userId },
        data: { status: 'REMOVED' },
      });
      await holder.query('COMMIT');
      expect((await pending).status).toBe(401);
      expect(
        (await h.prisma.dealerStorefront.findUniqueOrThrow({ where: { dealerId: owner.dealerId } }))
          .theme,
      ).toBe('DARK');
    } finally {
      await holder.query('ROLLBACK');
      if (pending) await Promise.allSettled([pending]);
      await h.prisma.dealerMember.updateMany({
        where: { dealerId: owner.dealerId, userId: owner.userId },
        data: { status: 'ACTIVE' },
      });
      await holder.end();
      await observer.end();
    }
  });
  it('rejects a queued enquiry after its verified customer session is revoked', async () => {
    const intent = await ticket();
    const session = await h.prisma.session.findFirstOrThrow({
      where: { userId: customerId, revokedAt: null },
    });
    const before = await h.prisma.enquiry.count({ where: { listingId } });
    const holder = new Client({ connectionString: env.DATABASE_URL });
    const observer = new Client({ connectionString: env.DATABASE_URL });
    await holder.connect();
    await observer.connect();
    await holder.query('BEGIN');
    const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await holder.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [listingId]);
    let pending: Promise<{ status: number }> | undefined;
    try {
      pending = buyer
        .post('/v1/enquiries/storefront')
        .send({ ticket: intent, consent: true })
        .then((res) => res);
      await observedWait(observer, pid, 'listings');
      await h.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await holder.query('COMMIT');
      expect((await pending).status).toBe(401);
      expect(await h.prisma.enquiry.count({ where: { listingId } })).toBe(before);
    } finally {
      await holder.query('ROLLBACK');
      if (pending) await Promise.allSettled([pending]);
      await holder.end();
      await observer.end();
    }
  });
  it('keeps RESERVED unavailable, removes SOLD immediately and rejects old forms', async () => {
    const intent = await ticket();
    await owner.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).expect(200);
    expect((await get('/cars')).body.data[0].availability).toBe('RESERVED');
    await get(`/cars/${slug}`).expect(404);
    await owner.agent.post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).expect(200);
    expect((await get('/cars')).body.data).toEqual([]);
    await h.agent().get(`/v1/storefront/enquiry-intent/${intent}`).expect(404);
    await buyer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone: '9840044441',
        accessToken: `dev-otp:919840044441:${env.PHONE_OTP_DEV_CODE}:sold-${stamp}`,
      })
      .expect(200);
    await buyer
      .post('/v1/enquiries/storefront')
      .send({ ticket: intent, consent: true })
      .expect(404);
    await h.agent().get(`/media/by-media/${firstMedia}/640.webp`).expect(404);
  });
  it('reaps only stale unassociated branding uploads, preserving disabled-site assets and retry safety', async () => {
    const id = randomUUID();
    const retainedId = randomUUID();
    const key = `storefront/${owner.dealerId}/${id}/original.png`;
    const storage = createLocalStorage();
    await storage.put(key, Buffer.from('synthetic orphan'), 'image/png');
    await h.prisma.media.create({
      data: {
        id,
        dealerId: owner.dealerId,
        ownerType: 'DEALER_COVER',
        storageKey: key,
        bytes: 16,
        mimeType: 'image/png',
        createdAt: new Date(0),
        warnings: [],
      },
    });
    await h.prisma.media.create({
      data: {
        id: retainedId,
        dealerId: owner.dealerId,
        ownerType: 'DEALER_COVER',
        storageKey: `storefront/${owner.dealerId}/${retainedId}/original.png`,
        bytes: 16,
        mimeType: 'image/png',
        status: 'READY',
        createdAt: new Date(0),
        warnings: [],
      },
    });
    await h.prisma.dealerStorefront.update({
      where: { dealerId: owner.dealerId },
      data: { status: 'DISABLED', heroMediaId: retainedId },
    });
    await createStorefrontMediaCleanup(h.prisma, storage)();
    expect(await h.prisma.media.findUnique({ where: { id } })).toBeNull();
    expect(await storage.get(key)).toBeNull();
    expect(await h.prisma.media.findUnique({ where: { id: retainedId } })).not.toBeNull();
    await createStorefrontMediaCleanup(h.prisma, storage)();
  });
  it('measures bounded public reads at representative inventory size without cross-tenant fallback', async () => {
    await owner.agent.put('/v1/dealer/storefront/enabled').send({ enabled: true }).expect(200);
    await other.agent
      .post('/v1/dealer/storefront')
      .send({ subdomain: `bench-b-${stamp}`, theme: 'DARK' })
      .expect(201);
    await other.agent.put('/v1/dealer/storefront/enabled').send({ enabled: true }).expect(200);
    const cars = await h.prisma.vehicle.createManyAndReturn({
      data: Array.from({ length: 320 }, (_, index) => ({
        dealerId: owner.dealerId,
        registrationNumber: `BENCH-A-${stamp}-${index}`,
        make: 'Honda',
        model: 'Benchmark',
        manufacturingYear: 2023,
        pricePaise: 85000000n,
      })),
    });
    await h.prisma.listing.createMany({
      data: cars.map((car, index) => ({
        vehicleId: car.id,
        dealerId: owner.dealerId,
        status: 'ACTIVE',
        slug: `benchmark-a-${stamp}-${index}`,
        publishedAt: new Date(),
      })),
    });
    const b = await h.prisma.vehicle.create({
      data: {
        dealerId: other.dealerId,
        registrationNumber: `BENCH-B-${stamp}`,
        make: 'Kia',
        model: 'Other tenant',
        pricePaise: 90000000n,
        listing: {
          create: {
            dealerId: other.dealerId,
            status: 'ACTIVE',
            slug: `benchmark-b-${stamp}`,
            publishedAt: new Date(),
          },
        },
      },
    });
    expect(b.dealerId).toBe(other.dealerId);
    const samples: number[] = [];
    for (let run = 0; run < 12; run += 1) {
      const started = performance.now();
      const response = await get('/cars?limit=24&page=2&brand=honda').expect(200);
      samples.push(performance.now() - started);
      expect(response.body.data).toHaveLength(24);
      expect(response.body.page.total).toBe(320);
      expect(
        response.body.data.every((row: { slug: string }) =>
          row.slug.startsWith(`benchmark-a-${stamp}`),
        ),
      ).toBe(true);
      expect(response.headers['cache-control']).toContain('no-store');
    }
    expect((await get('/cars?brand=kia')).body.data).toEqual([]);
    expect(
      (await get('/cars', `bench-b-${stamp}.dealers-drive.com`)).body.data.map(
        (row: { slug: string }) => row.slug,
      ),
    ).toEqual([`benchmark-b-${stamp}`]);
    const sorted = samples.sort((a, b) => a - b);
    const benchmark = {
      event: 'storefront.benchmark',
      environment: 'isolated-local-postgres',
      inventory: 320,
      pageSize: 24,
      samples: 12,
      p50Ms: Number(sorted[6]!.toFixed(2)),
      p95Ms: Number(sorted[11]!.toFixed(2)),
      cachePolicy: 'private, no-store',
      crossTenantFilter: 'zero-results',
      network: 'local-only',
      browserPerformance: 'not measured',
    };
    console.log(JSON.stringify(benchmark));
    const output = process.env.STOREFRONT_BENCHMARK_OUTPUT;
    if (output) await writeFile(output, JSON.stringify(benchmark, null, 2));
  });
});
