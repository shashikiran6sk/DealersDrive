import { readFile } from 'node:fs/promises';
import type request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { env } from '../src/config/env.js';
import { createApprovalKit } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

let h: AuthHarness;
let admin: request.Agent;
let owner: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
const storage = createLocalStorage();
let plate = 6100;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'media-visible');
  owner = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);
});

afterAll(async () => {
  await h.close();
});

async function photographed(dealer: Dealership = owner) {
  plate += 1;
  const car = await kit.published(dealer, `KL41PM${String(plate)}`);
  const first = await h.prisma.media.findUniqueOrThrow({ where: { id: car.mediaIds[0] } });
  const bytes = await readFile(new URL('./fixtures/media/browser-yard.jpg', import.meta.url));
  await storage.put(first.storageKey, bytes, 'image/jpeg');
  const media = await h.prisma.media.update({
    where: { id: first.id },
    data: { bytes: bytes.length },
  });
  return { ...car, media, bytes, path: `/media/by-media/${media.id}/640.webp` };
}

it('refuses a previously public vehicle image immediately after dealer suspension (BUG-004)', async () => {
  const car = await photographed();
  await h.agent().get(`/v1/vehicles/${car.slug}`).expect(200);
  const first = await h.agent().get(car.path).expect(200);
  expect(Buffer.from(first.body as Buffer)).toEqual(car.bytes);
  await admin
    .post(`/v1/admin/dealers/${owner.dealerId}/suspend`)
    .send({ reason: 'Isolated media visibility regression' })
    .expect(200);
  const listing = await h.agent().get(`/v1/vehicles/${car.slug}`);
  const image = await h.agent().get(car.path);
  const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: owner.dealerId } });
  console.log(
    JSON.stringify({
      bug: 'BUG-004',
      canonical: 'SEC-DISC-002',
      beforeImage: first.status,
      dealer: dealer.status,
      listing: listing.status,
      afterImage: image.status,
      cacheControl: image.headers['cache-control'],
    }),
  );
  expect(dealer.status).toBe('SUSPENDED');
  expect(listing.status).toBe(404);
  expect(image.status).toBe(404);
  expect(image.headers['cache-control']).toBe('no-store');
  await admin
    .post(`/v1/admin/dealers/${owner.dealerId}/reinstate`)
    .send({ note: 'Isolated media recovery' })
    .expect(200);
  await h.agent().get(car.path).expect(200);
  await h.agent().get(`/v1/vehicles/${car.slug}`).expect(200);
});

/**
 * R108. A served image may be stored, but never reused without asking: `no-cache`
 * makes every reuse a conditional request, and that request runs the same
 * visibility check as a first view — so a suspension or a listing decision still
 * takes effect on the next view. Only the S3 download is saved, by the 304.
 */
it('does not permit reusable cached vehicle responses to bypass mutable visibility', async () => {
  const dealer = await marketplaceFixtures(h, 'media-cache').dealership();
  const car = await photographed(dealer);
  const image = await h.agent().get(car.path).expect(200);
  console.log(
    JSON.stringify({
      bug: 'BUG-004',
      case: 'cache policy',
      cacheControl: image.headers['cache-control'],
    }),
  );
  expect(image.headers['cache-control']).toBe('no-cache');
  expect(image.headers['cache-control']).not.toMatch(/max-age|immutable/);
});

it('answers a revalidation with 304 while visible, and 404 the moment the dealer is suspended', async () => {
  const dealer = await marketplaceFixtures(h, 'media-revalidate').dealership();
  const car = await photographed(dealer);
  const first = await h.agent().get(car.path).expect(200);
  const etag = String(first.headers.etag);

  const again = await h.agent().get(car.path).set('If-None-Match', etag).expect(304);
  expect(again.headers.etag).toBe(etag);
  expect(again.headers['cache-control']).toBe('no-cache');

  await admin
    .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
    .send({ reason: 'Revalidation after suspension' })
    .expect(200);
  const denied = await h.agent().get(car.path).set('If-None-Match', etag).expect(404);
  expect(denied.headers['cache-control']).toBe('no-store');
  expect(denied.headers.etag).not.toBe(etag);
});

it('checks all derivative widths, HEAD and conditional requests after suspension and reinstatement', async () => {
  const dealer = await marketplaceFixtures(h, 'media-width').dealership();
  const car = await photographed(dealer);
  const webp = await readFile(new URL('./fixtures/media/browser-car.webp', import.meta.url));
  const variants = Object.fromEntries(
    [320, 640, 1024, 1600].map((width) => [
      String(width),
      `vehicles/${car.vehicleId}/${car.media.id}/${String(width)}.webp`,
    ]),
  );
  for (const key of Object.values(variants)) await storage.put(key, webp, 'image/webp');
  await h.prisma.media.update({ where: { id: car.media.id }, data: { variants } });
  const first = await h.agent().get(car.path).expect(200);
  const etag = String(first.headers.etag);
  expect(etag).not.toBe('undefined');
  await h.agent().get(car.path).set('If-None-Match', etag).expect(304);
  await admin
    .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
    .send({ reason: 'Derivative visibility' })
    .expect(200);
  for (const width of [320, 640, 1024, 1600]) {
    const path = `/media/by-media/${car.media.id}/${String(width)}.webp`;
    for (const verb of ['get', 'head'] as const) {
      const denied = await h.agent()[verb](path).set('If-None-Match', etag).expect(404);
      expect(denied.headers['cache-control']).toBe('no-store');
    }
    await admin.get(path).expect(404);
    await dealer.agent.get(path).expect(404);
  }
  await admin.post(`/v1/admin/dealers/${dealer.dealerId}/reinstate`).send({}).expect(200);
  for (const width of [320, 640, 1024, 1600]) {
    const image = await h
      .agent()
      .get(`/media/by-media/${car.media.id}/${String(width)}.webp`)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/webp');
    expect(image.headers['cache-control']).toBe('no-cache');
    expect(Buffer.from(image.body as Buffer)).toEqual(webp);
  }
  const head = await h.agent().head(car.path).expect(200);
  expect(Number(head.headers['content-length'])).toBe(webp.length);
  await h.prisma.media.update({
    where: { id: car.media.id },
    data: { variants: { '1024': variants['1024'] } },
  });
  const fallback = await h.agent().get(`/media/by-media/${car.media.id}/1600.webp`).expect(200);
  expect(Buffer.from(fallback.body as Buffer)).toEqual(webp);
  await h.prisma.media.update({ where: { id: car.media.id }, data: { variants: {} } });
  const original = await h.agent().get(car.path).expect(200);
  expect(original.headers['content-type']).toContain('image/jpeg');
  expect(Buffer.from(original.body as Buffer)).toEqual(car.bytes);
});

it.each(['ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN'] as const)(
  'preserves %s stock, customer history and audits through suspension and reinstatement',
  async (status) => {
    const dealer = await marketplaceFixtures(h, `media-life-${status.toLowerCase()}`).dealership();
    const car = await photographed(dealer);
    const buyer = h.agent();
    const phone = `98275${String(plate).padStart(5, '0')}`;
    const proved = await buyer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:media-life-${status}`,
      })
      .expect(200);
    const joined = await buyer
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proved.body.signUpToken, fullName: 'Media Visibility Fixture' })
      .expect(201);
    const customerId = String(joined.body.customer.id);
    await buyer.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
    await buyer
      .post('/v1/enquiries')
      .send({ listingSlug: car.slug, message: 'Isolated media lifecycle fixture' })
      .expect(201);
    const action =
      status === 'RESERVED'
        ? 'reserve'
        : status === 'SOLD'
          ? 'mark-sold'
          : status === 'WITHDRAWN'
            ? 'withdraw'
            : null;
    if (action)
      await dealer.agent
        .post(`/v1/dealer/vehicles/${car.vehicleId}/${action}`)
        .send(action === 'withdraw' ? { reason: 'OTHER' } : {})
        .expect(200);
    const before = {
      listing: await h.prisma.listing.findUniqueOrThrow({ where: { id: car.listingId } }),
      vehicle: await h.prisma.vehicle.findUniqueOrThrow({ where: { id: car.vehicleId } }),
      media: await h.prisma.media.findMany({
        where: { id: { in: car.mediaIds } },
        orderBy: { id: 'asc' },
      }),
      attachments: await h.prisma.vehicleMedia.findMany({
        where: { vehicleId: car.vehicleId },
        orderBy: { id: 'asc' },
      }),
      members: await h.prisma.dealerMember.findMany({
        where: { dealerId: dealer.dealerId },
        orderBy: { id: 'asc' },
      }),
      enquiries: await h.prisma.enquiry.findMany({ where: { customerId }, orderBy: { id: 'asc' } }),
      saved: await h.prisma.savedVehicle.findMany({
        where: { customerId },
        orderBy: { id: 'asc' },
      }),
    };
    const visible = status === 'ACTIVE' || status === 'RESERVED';
    await h
      .agent()
      .get(car.path)
      .expect(visible ? 200 : 404);
    await admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
      .send({ reason: 'Isolated cross-lifecycle media check' })
      .expect(200);
    await h.agent().get(car.path).expect(404);
    await h.agent().get(`/v1/vehicles/${car.slug}`).expect(404);
    await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(404);
    const publicCars = await h.agent().get('/v1/vehicles').expect(200);
    expect(JSON.stringify(publicCars.body)).not.toContain(car.slug);
    await h.agent().get(`/v1/dealers/${dealer.slug}/vehicles`).expect(404);
    await dealer.agent.get('/v1/dealer/enquiries').expect(401);
    const saved = await buyer.get('/v1/saved-vehicles').expect(200);
    expect(
      saved.body.data.find((row: { vehicle: { slug: string } }) => row.vehicle.slug === car.slug)
        .vehicle.image,
    ).toBeNull();
    const mine = await buyer.get('/v1/enquiries').expect(200);
    expect(
      mine.body.data.find((row: { id: string }) => row.id === before.enquiries[0]?.id).vehicle.href,
    ).toBeNull();
    await admin.get(`/v1/admin/enquiries/${before.enquiries[0]?.id ?? ''}`).expect(200);
    const preview = new URL(await storage.signedReadUrl(car.media.storageKey, 300));
    await h
      .agent()
      .get(preview.pathname + preview.search)
      .expect(200);
    preview.searchParams.set('signature', '0'.repeat(64));
    await h
      .agent()
      .get(preview.pathname + preview.search)
      .expect(404);
    await admin.post(`/v1/admin/dealers/${dealer.dealerId}/reinstate`).send({}).expect(200);
    await h
      .agent()
      .get(car.path)
      .expect(visible ? 200 : 404);
    expect(await h.prisma.listing.findUniqueOrThrow({ where: { id: car.listingId } })).toEqual(
      before.listing,
    );
    expect(await h.prisma.vehicle.findUniqueOrThrow({ where: { id: car.vehicleId } })).toEqual(
      before.vehicle,
    );
    expect(
      await h.prisma.media.findMany({
        where: { id: { in: car.mediaIds } },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before.media);
    expect(
      await h.prisma.vehicleMedia.findMany({
        where: { vehicleId: car.vehicleId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before.attachments);
    expect(
      await h.prisma.dealerMember.findMany({
        where: { dealerId: dealer.dealerId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before.members);
    expect(
      await h.prisma.enquiry.findMany({ where: { customerId }, orderBy: { id: 'asc' } }),
    ).toEqual(before.enquiries);
    expect(
      await h.prisma.savedVehicle.findMany({ where: { customerId }, orderBy: { id: 'asc' } }),
    ).toEqual(before.saved);
    const trail = await h.prisma.auditLog.findMany({
      where: {
        entityType: 'Dealer',
        entityId: dealer.dealerId,
        action: { in: ['dealer.suspended', 'dealer.reinstated'] },
      },
      orderBy: { id: 'asc' },
    });
    expect(trail.map((row) => row.action)).toEqual(['dealer.suspended', 'dealer.reinstated']);
    const actor = await h.prisma.user.findUniqueOrThrow({
      where: { email: env.adminAllowlist[0] },
    });
    expect(trail.every((row) => row.actorId === actor.id && row.actorType === 'ADMIN')).toBe(true);
  },
);

it('rejects ID/width manipulation, unattached and non-ready images without changing another dealer', async () => {
  const dealer = await marketplaceFixtures(h, 'media-negative').dealership();
  const car = await photographed(dealer);
  await h.agent().get(`/media/by-media/${car.vehicleId}/640.webp`).expect(404);
  await h.agent().get(`/media/by-media/${car.listingId}/640.webp`).expect(404);
  for (const id of ['not-an-id', crypto.randomUUID()])
    await h.agent().get(`/media/by-media/${id}/640.webp`).expect(404);
  for (const width of ['0', '-1', '4001', 'garbage'])
    await h.agent().get(`/media/by-media/${car.media.id}/${width}.webp`).expect(404);
  for (const status of ['PENDING', 'FAILED', 'ORPHAN'] as const) {
    await h.prisma.media.update({ where: { id: car.media.id }, data: { status } });
    await h.agent().get(car.path).expect(404);
  }
  await h.prisma.media.update({ where: { id: car.media.id }, data: { status: 'READY' } });
  await admin
    .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
    .send({ reason: 'No identity bypass' })
    .expect(200);
  const other = await photographed(await marketplaceFixtures(h, 'media-other').dealership());
  await h.agent().get(car.path).query({ dealerId: other.media.dealerId }).expect(404);
  await h.agent().get(other.path).expect(200);
  await h.prisma.vehicleMedia.delete({ where: { mediaId: car.media.id } });
  await admin.post(`/v1/admin/dealers/${dealer.dealerId}/reinstate`).send({}).expect(200);
  await h.agent().get(car.path).expect(404);
  expect(await storage.get(car.media.storageKey)).toEqual(car.bytes);
});

it('preserves private yard/KYC previews without exposing originals through public paths', async () => {
  const dealer = await marketplaceFixtures(h, 'media-private').dealership('DRAFT');
  const jpeg = await readFile(new URL('./fixtures/media/browser-yard.jpg', import.meta.url));
  const yard = await dealer.agent
    .post('/v1/dealer/yard-photo/presign')
    .send({ fileName: 'fixture-yard.jpg', mimeType: 'image/jpeg', bytes: jpeg.length })
    .expect(201);
  const upload = new URL(String(yard.body.uploadUrl));
  await h
    .agent()
    .put(upload.pathname + upload.search)
    .set('Content-Type', 'image/jpeg')
    .send(jpeg)
    .expect(200);
  const committed = await dealer.agent
    .post('/v1/dealer/yard-photo/commit')
    .send({ mediaId: yard.body.mediaId })
    .expect(200);
  await h.prisma.dealer.update({
    where: { id: dealer.dealerId },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  });
  const preview = new URL(String(committed.body.url));
  const first = await h
    .agent()
    .get(preview.pathname + preview.search)
    .expect(200);
  expect(first.headers['cache-control']).toBe('private, no-store');
  await h
    .agent()
    .get(`/media/by-media/${String(yard.body.mediaId)}/640.webp`)
    .expect(200);
  const pdf = await readFile(new URL('./fixtures/media/browser-document.pdf', import.meta.url));
  const doc = await dealer.agent
    .post('/v1/dealer/documents/presign')
    .send({
      type: 'PAN_CARD',
      fileName: 'fixture-pan.pdf',
      mimeType: 'application/pdf',
      bytes: pdf.length,
    })
    .expect(201);
  const docUpload = new URL(String(doc.body.uploadUrl));
  await h
    .agent()
    .put(docUpload.pathname + docUpload.search)
    .set('Content-Type', 'application/pdf')
    .send(pdf)
    .expect(200);
  await dealer.agent
    .post('/v1/dealer/documents/PAN_CARD/commit')
    .send({ documentId: doc.body.documentId })
    .expect(200);
  const key = docUpload.searchParams.get('key') ?? '';
  expect(key).not.toBe('');
  await h.agent().get(`/media/${key}`).expect(404);
  await h
    .agent()
    .get(`/media/by-media/${String(doc.body.documentId)}/640.webp`)
    .expect(404);
  const signed = new URL(await storage.signedReadUrl(key, 300));
  const read = await h
    .agent()
    .get(signed.pathname + signed.search)
    .expect(200);
  expect(Buffer.from(read.body as Buffer)).toEqual(pdf);
  await h.agent().get('/private').query({ key }).expect(400);
  await admin
    .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
    .send({ reason: 'Private history remains authorized' })
    .expect(200);
  await dealer.agent.get('/v1/dealer/documents').expect(401);
  await dealer.agent.get('/v1/dealer/yard-photo').expect(401);
  await h
    .agent()
    .get(preview.pathname + preview.search)
    .expect(200);
  await h
    .agent()
    .get(signed.pathname + signed.search)
    .expect(200);
  signed.searchParams.set('key', 'dealers/foreign/kyc/pan.pdf');
  await h
    .agent()
    .get(signed.pathname + signed.search)
    .expect(404);
  expect(
    await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: String(doc.body.documentId) } }),
  ).toMatchObject({
    dealerId: dealer.dealerId,
    status: 'UPLOADED',
    fileName: 'fixture-pan.pdf',
    mediaId: null,
  });
});
