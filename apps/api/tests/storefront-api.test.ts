import { randomUUID } from 'node:crypto';

import type { ListingStatus } from '@prisma/client';
import type request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';
import { createStorefrontService } from '../src/modules/storefront/storefront.facade.js';
import {
  createAuthHarness,
  createFakeGoogle,
  createRecordingMailer,
  type AuthHarness,
} from './auth-harness.js';

const SECRET = 'storefront-test-service-secret-32-characters';
const stamp = randomUUID().slice(0, 8);
let h: AuthHarness;
type Dealer = {
  id: string;
  userId: string;
  agent: request.Agent;
  subdomain: string;
  hostname: string;
};
let a: Dealer;
let b: Dealer;
let manager: request.Agent;
let staff: request.Agent;
let liveA: { id: string; slug: string; vehicleId: string };
let liveB: { id: string; slug: string; vehicleId: string };
let plate = 1000;
let png: Buffer;
let logoId: string;

async function person(name: string) {
  h.google.claims = {
    subject: `${name}-${stamp}`,
    email: `${name}.${stamp}@example.com`,
    name,
    emailVerified: true,
  };
  const agent = h.agent();
  await h.signIn(agent);
  const user = await h.prisma.user.findUniqueOrThrow({ where: { email: h.google.claims.email } });
  return { agent, userId: user.id };
}
async function dealer(name: string): Promise<Dealer> {
  const owner = await person(name);
  const row = await h.prisma.dealer.create({
    data: {
      slug: `website-${name}-${stamp}`,
      brandName: `${name} Motors`,
      legalName: `${name} Motors ${stamp}`,
      status: 'ACTIVE',
      approvedAt: new Date(),
      contactPhone: '+919840099991',
      city: 'Vellore',
      addressLine: 'Synthetic test yard',
      members: { create: { userId: owner.userId, role: 'OWNER', permissions: [] } },
    },
  });
  const subdomain = `${name}-${stamp}`;
  return { id: row.id, ...owner, subdomain, hostname: `${subdomain}.dealers-drive.com` };
}
async function car(
  owner: Dealer,
  status: ListingStatus = 'ACTIVE',
  destination = true,
  title = 'Honda',
) {
  plate += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.id,
      registrationNumber: `TN99SF${plate}`,
      make: title,
      model: 'City',
      manufacturingYear: 2023,
      kilometersDriven: 15000,
      fuelType: 'PETROL',
      transmission: 'MANUAL',
      pricePaise: 85000000n,
    },
  });
  const row = await h.prisma.listing.create({
    data: {
      dealerId: owner.id,
      vehicleId: vehicle.id,
      status,
      slug: `website-car-${stamp}-${plate}`,
      publishedAt: new Date(),
      storefrontPublished: destination,
    },
  });
  return { id: row.id, slug: row.slug!, vehicleId: vehicle.id };
}
function publicGet(path: string, owner = a) {
  return h
    .agent()
    .get(`/v1/storefront${path}`)
    .set('x-dd-storefront-host', owner.hostname)
    .set('x-dd-storefront-secret', SECRET);
}
async function customer() {
  const agent = h.agent();
  const phone = '9840099992';
  const result = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:storefront-${stamp}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: result.body.signUpToken, fullName: 'Synthetic Customer' })
    .expect(201);
  return agent;
}
async function intent(slug: string, owner = a) {
  const res = await h
    .agent()
    .post('/v1/storefront/enquiry-intent')
    .set('x-dd-storefront-host', owner.hostname)
    .set('x-dd-storefront-secret', SECRET)
    .send({ listingSlug: slug })
    .expect(200);
  return new URL(res.body.url as string).searchParams.get('ticket')!;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle(), createRecordingMailer(), {
    STOREFRONT_ENABLED: true,
    STOREFRONT_DEFAULT_DOMAIN_READY: true,
    STOREFRONT_SERVICE_SECRET: SECRET,
  });
  a = await dealer('alpha');
  b = await dealer('beta');
  const m = await person('manager');
  const s = await person('staff');
  manager = m.agent;
  staff = s.agent;
  await h.prisma.dealerMember.createMany({
    data: [
      { dealerId: a.id, userId: m.userId, role: 'MANAGER', permissions: [] },
      { dealerId: a.id, userId: s.userId, role: 'STAFF', permissions: [] },
    ],
  });
  png = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#155e75' } })
    .png()
    .toBuffer();
});
afterAll(async () => {
  await h.close();
});

describe('authorized website control plane', () => {
  it('requires authentication and reports a real empty configuration', async () => {
    await h.agent().get('/v1/dealer/storefront').expect(401);
    const res = await a.agent.get('/v1/dealer/storefront').expect(200);
    expect(res.body).toMatchObject({ enabled: true, eligible: true, storefront: null });
    expect(res.headers['cache-control']).toContain('no-store');
  });
  it('creates once under concurrent owner requests', async () => {
    const rows = await Promise.all(
      Array.from({ length: 4 }, () =>
        a.agent.post('/v1/dealer/storefront').send({ subdomain: a.subdomain, theme: 'LIGHT' }),
      ),
    );
    expect(rows.map((row) => row.status)).toEqual([201, 201, 201, 201]);
    expect(new Set(rows.map((row) => row.body.storefront.id)).size).toBe(1);
    expect(rows[0]!.body.storefront).toMatchObject({ status: 'DRAFT', publicUrl: null });
    await publicGet('/site').expect(404);
  });
  it('rejects cross-tenant collisions, identity changes and mass assignment', async () => {
    await b.agent
      .post('/v1/dealer/storefront')
      .send({ subdomain: a.subdomain, theme: 'DARK' })
      .expect(409);
    await a.agent
      .post('/v1/dealer/storefront')
      .send({ subdomain: `new-${stamp}`, theme: 'LIGHT' })
      .expect(409);
    await b.agent
      .post('/v1/dealer/storefront')
      .send({ subdomain: 'www', theme: 'LIGHT' })
      .expect(400);
    await a.agent
      .patch('/v1/dealer/storefront')
      .send({ dealerId: b.id, theme: 'DARK' })
      .expect(400);
    await a.agent.patch('/v1/dealer/storefront').send({ status: 'ACTIVE' }).expect(400);
  });
  it('restricts managers to read and denies staff', async () => {
    await manager.get('/v1/dealer/storefront').expect(200);
    await manager.patch('/v1/dealer/storefront').send({ theme: 'DARK' }).expect(403);
    await manager.put('/v1/dealer/storefront/enabled').send({ enabled: false }).expect(403);
    await staff.get('/v1/dealer/storefront').expect(403);
    await staff
      .post('/v1/dealer/storefront')
      .send({ subdomain: a.subdomain, theme: 'LIGHT' })
      .expect(403);
  });
  it('persists bounded branding and exactly two themes', async () => {
    for (const theme of ['DARK', 'LIGHT']) {
      const res = await a.agent
        .patch('/v1/dealer/storefront')
        .send({
          theme,
          displayName: 'Alpha Select',
          headline: 'Find your next car',
          description: 'Approved inventory from our yard.',
          about: 'Visit our synthetic test dealership.',
          accentColor: '#155E75',
          contactPhone: '9840099991',
          whatsappPhone: '9840099991',
          socialUrls: ['https://www.instagram.com/alpha'],
        })
        .expect(200);
      expect(res.body.storefront).toMatchObject({
        theme,
        displayName: 'Alpha Select',
        accentColor: '#155e75',
        contactPhone: '+919840099991',
      });
      expect((await a.agent.get('/v1/dealer/storefront')).body.storefront.theme).toBe(theme);
    }
    await a.agent.patch('/v1/dealer/storefront').send({ theme: 'CUSTOM' }).expect(400);
    await a.agent
      .patch('/v1/dealer/storefront')
      .send({ headline: '<script>alert(1)</script>' })
      .expect(400);
    await a.agent
      .patch('/v1/dealer/storefront')
      .send({ socialUrls: ['https://127.0.0.1/x'] })
      .expect(400);
  });
  it('keeps activation pending when wildcard readiness is not configured', async () => {
    await b.agent
      .post('/v1/dealer/storefront')
      .send({ subdomain: b.subdomain, theme: 'DARK' })
      .expect(201);
    const noDns = createStorefrontService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
      config: {
        ...env,
        STOREFRONT_ENABLED: true,
        STOREFRONT_SERVICE_SECRET: SECRET,
        STOREFRONT_DEFAULT_DOMAIN_READY: false,
      },
    });
    const state = await noDns.setEnabled({ dealerId: b.id, userId: b.userId }, true);
    expect(state).toMatchObject({
      infrastructureReady: false,
      storefront: { status: 'PENDING_ACTIVATION', publicUrl: null },
    });
    await publicGet('/site', b).expect(404);
  });
  it('activates only ready sites and supports idempotent activation', async () => {
    for (const owner of [a, b]) {
      const res = await owner.agent
        .put('/v1/dealer/storefront/enabled')
        .send({ enabled: true })
        .expect(200);
      expect(res.body.storefront).toMatchObject({
        status: 'ACTIVE',
        publicUrl: `https://${owner.hostname}`,
      });
      await owner.agent.put('/v1/dealer/storefront/enabled').send({ enabled: true }).expect(200);
    }
    liveA = await car(a);
    liveB = await car(b, 'ACTIVE', true, 'Kia');
  });
});

describe('trusted public tenant boundary', () => {
  it('fails closed for unverified and expired custom domains', async () => {
    const site = await h.prisma.dealerStorefront.findUniqueOrThrow({ where: { dealerId: a.id } });
    const hostname = `cars-${stamp}.example.com`;
    const domain = await h.prisma.storefrontDomain.create({
      data: { storefrontId: site.id, hostname, kind: 'CUSTOM', ownershipToken: 'synthetic-proof' },
    });
    const get = () =>
      h
        .agent()
        .get('/v1/storefront/site')
        .set('x-dd-storefront-host', hostname)
        .set('x-dd-storefront-secret', SECRET);
    await get().expect(404);
    await h.prisma.storefrontDomain.update({
      where: { id: domain.id },
      data: {
        status: 'ACTIVE',
        verifiedAt: new Date(),
        ownershipVerifiedAt: new Date(),
        certificateReady: true,
        checkedAt: new Date(0),
      },
    });
    await get().expect(404);
    await h.prisma.storefrontDomain.update({
      where: { id: domain.id },
      data: { checkedAt: new Date() },
    });
    const verified = await get().expect(200);
    expect(verified.body).toMatchObject({
      requestedHostname: hostname,
      primaryHostname: a.hostname,
      name: 'Alpha Select',
    });
    await h.prisma.storefrontDomain.update({
      where: { id: domain.id },
      data: { status: 'REMOVED' },
    });
    await get().expect(404);
  });
  it('does not trust direct host or forwarded-host assertions', async () => {
    await h.agent().get('/v1/storefront/site').set('Host', a.hostname).expect(401);
    await h.agent().get('/v1/storefront/site').set('x-forwarded-host', a.hostname).expect(401);
    await h
      .agent()
      .get('/v1/storefront/site')
      .set('x-dd-storefront-host', a.hostname)
      .set('x-dd-storefront-secret', 'incorrect')
      .expect(401);
    await h
      .agent()
      .get('/v1/storefront/site')
      .set('x-dd-storefront-host', 'https://bad.com')
      .set('x-dd-storefront-secret', SECRET)
      .expect(400);
    await h
      .agent()
      .get('/v1/storefront/site')
      .set('x-dd-storefront-host', `unknown-${stamp}.dealers-drive.com`)
      .set('x-dd-storefront-secret', SECRET)
      .expect(404);
  });
  it('returns explicit branding without private dealer fields or another tenant', async () => {
    const res = await publicGet('/site').expect(200);
    expect(res.body).toMatchObject({
      name: 'Alpha Select',
      theme: 'LIGHT',
      primaryHostname: a.hostname,
      contactPhone: '+919840099991',
    });
    for (const key of [
      'id',
      'dealerId',
      'documents',
      'gstin',
      'pan',
      'members',
      'domains',
      'ownershipToken',
      'statusReason',
      'creditBalance',
    ])
      expect(res.body).not.toHaveProperty(key);
    expect(JSON.stringify(res.body)).not.toContain('beta');
    expect(res.headers['cache-control']).toContain('no-store');
    expect((await publicGet('/site', b)).body.theme).toBe('DARK');
  });
  it('isolates inventory, details, counts, search and filter vocabulary', async () => {
    const alpha = await publicGet('/cars').expect(200);
    const beta = await publicGet('/cars', b).expect(200);
    expect(alpha.body.data.map((row: { slug: string }) => row.slug)).toEqual([liveA.slug]);
    expect(beta.body.data.map((row: { slug: string }) => row.slug)).toEqual([liveB.slug]);
    await publicGet(`/cars/${liveB.slug}`).expect(404);
    await publicGet(`/cars/${liveA.slug}`).expect(200);
    expect((await publicGet('/cars?q=Kia')).body.page.total).toBe(0);
    expect((await publicGet('/cars?brand=kia')).body.page.total).toBe(0);
    expect((await publicGet('/cars?brand=honda&fuel=petrol&minYear=2020')).body.page.total).toBe(1);
    await publicGet('/cars?dealer=beta').expect(400);
    await publicGet('/cars?limit=100000').expect(400);
    await publicGet('/cars?minYear=2025&maxYear=2020').expect(400);
  });
  it('respects moderation and unavailable states, with reserved cards unavailable', async () => {
    for (const status of [
      'DRAFT',
      'PENDING_REVIEW',
      'CHANGES_REQUESTED',
      'REJECTED',
      'SOLD',
      'WITHDRAWN',
      'RESERVED',
    ] as const) {
      const row = await car(a, status);
      await publicGet(`/cars/${row.slug}`).expect(404);
      const found = (await publicGet('/cars')).body.data.find(
        (entry: { slug: string }) => entry.slug === row.slug,
      ) as { availability: { status: string } } | undefined;
      if (status === 'RESERVED') expect(found).toBeDefined();
      else expect(found).toBeUndefined();
    }
    const hidden = await car(a, 'ACTIVE', false);
    await publicGet(`/cars/${hidden.slug}`).expect(404);
    const page = await publicGet('/cars?limit=1&page=2').expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.page.total).toBe(2);
  });
  it('offers a protected noindex preview without publishing drafts', async () => {
    await h.agent().get('/v1/dealer/storefront/preview').expect(401);
    const preview = await a.agent.get('/v1/dealer/storefront/preview').expect(200);
    expect(preview.headers['x-robots-tag']).toContain('noindex');
    expect(preview.body.site.name).toBe('Alpha Select');
    expect(
      preview.body.inventory.data.every(
        (row: { dealer: { name: string } }) => row.dealer.name === 'alpha Motors',
      ),
    ).toBe(true);
  });
  it('updates independent destinations without changing lifecycle and refuses IDOR', async () => {
    await b.agent
      .put(`/v1/dealer/storefront/publication/${liveA.id}`)
      .send({ marketplacePublished: false, storefrontPublished: false })
      .expect(404);
    await manager
      .put(`/v1/dealer/storefront/publication/${liveA.id}`)
      .send({ marketplacePublished: false, storefrontPublished: false })
      .expect(403);
    await a.agent
      .put(`/v1/dealer/storefront/publication/${liveA.id}`)
      .send({ marketplacePublished: false, storefrontPublished: true })
      .expect(204);
    await publicGet(`/cars/${liveA.slug}`).expect(200);
    await h.agent().get(`/v1/vehicles/${liveA.slug}`).expect(404);
    await a.agent
      .put(`/v1/dealer/storefront/publication/${liveA.id}`)
      .send({ marketplacePublished: false, storefrontPublished: false })
      .expect(204);
    await publicGet(`/cars/${liveA.slug}`).expect(404);
    expect((await h.prisma.listing.findUniqueOrThrow({ where: { id: liveA.id } })).status).toBe(
      'ACTIVE',
    );
    await a.agent
      .put(`/v1/dealer/storefront/publication/${liveA.id}`)
      .send({ marketplacePublished: true, storefrontPublished: true })
      .expect(204);
  });
});

describe('branding media security and delivery', () => {
  it('rejects actual size mismatches and invalid image decoders', async () => {
    const invalidPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const malformed = await a.agent
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'invalid.png', mimeType: 'image/png', bytes: invalidPng.length })
      .expect(200);
    const url = new URL(malformed.body.uploadUrl as string);
    await a.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/png')
      .send(invalidPng)
      .expect(200);
    await a.agent
      .post('/v1/dealer/storefront/media/commit')
      .send({ mediaId: malformed.body.mediaId })
      .expect(422);
    await h.prisma.media.update({
      where: { id: malformed.body.mediaId as string },
      data: { bytes: 9 },
    });
    await a.agent
      .post('/v1/dealer/storefront/media/commit')
      .send({ mediaId: malformed.body.mediaId })
      .expect(422);
  });
  it('processes real synthetic image bytes and stays private before association', async () => {
    const upload = await a.agent
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'synthetic.png', mimeType: 'image/png', bytes: png.length })
      .expect(200);
    logoId = upload.body.mediaId as string;
    const url = new URL(upload.body.uploadUrl as string);
    await a.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/png')
      .send(png)
      .expect(200);
    await h.agent().get(`/media/by-media/${logoId}/640.webp`).expect(404);
    await b.agent.post('/v1/dealer/storefront/media/commit').send({ mediaId: logoId }).expect(404);
    await a.agent.post('/v1/dealer/storefront/media/commit').send({ mediaId: logoId }).expect(200);
    await a.agent.post('/v1/dealer/storefront/media/commit').send({ mediaId: logoId }).expect(200);
    await a.agent.get(`/v1/dealer/storefront/media/${logoId}/640.webp`).expect(200);
    await manager.get(`/v1/dealer/storefront/media/${logoId}/640.webp`).expect(200);
    await b.agent.get(`/v1/dealer/storefront/media/${logoId}/640.webp`).expect(404);
    await staff.get(`/v1/dealer/storefront/media/${logoId}/640.webp`).expect(403);
    await h.agent().get(`/v1/dealer/storefront/media/${logoId}/640.webp`).expect(401);
    await a.agent.get(`/v1/dealer/storefront/media/${logoId}/1.webp`).expect(400);
    await h.agent().get(`/media/by-media/${logoId}/640.webp`).expect(404);
    await a.agent
      .patch('/v1/dealer/storefront')
      .send({ logoMediaId: logoId, heroMediaId: logoId, yardMediaIds: [logoId] })
      .expect(200);
    const response = await h.agent().get(`/media/by-media/${logoId}/640.webp`).expect(200);
    expect(response.headers['content-type']).toContain('image/webp');
    const metadata = await sharp(response.body as Buffer).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBe(24);
    expect((await publicGet('/site')).body.logoUrl).toContain(logoId);
  });
  it('rejects another dealer’s images, KYC, unavailable media and external URLs', async () => {
    await b.agent.patch('/v1/dealer/storefront').send({ heroMediaId: logoId }).expect(422);
    const doc = await h.prisma.media.create({
      data: {
        dealerId: a.id,
        ownerType: 'DEALER_DOCUMENT',
        storageKey: `private/${stamp}`,
        mimeType: 'application/pdf',
        bytes: 10,
        status: 'READY',
        warnings: [],
      },
    });
    await a.agent.patch('/v1/dealer/storefront').send({ heroMediaId: doc.id }).expect(422);
    await h.agent().get(`/media/by-media/${doc.id}/640.webp`).expect(404);
    await a.agent.patch('/v1/dealer/storefront').send({ logoMediaId: randomUUID() }).expect(422);
    await a.agent
      .patch('/v1/dealer/storefront')
      .send({ heroMediaId: 'https://evil.com/x' })
      .expect(400);
    await staff
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'x.png', mimeType: 'image/png', bytes: 100 })
      .expect(403);
    await a.agent
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'x.svg', mimeType: 'image/svg+xml', bytes: 100 })
      .expect(400);
    await a.agent
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'x.png', mimeType: 'image/png', bytes: 100000000 })
      .expect(400);
  });
  it('rejects missing, mismatched and malformed actual upload bytes', async () => {
    const missing = await a.agent
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'missing.png', mimeType: 'image/png', bytes: 5 })
      .expect(200);
    await a.agent
      .post('/v1/dealer/storefront/media/commit')
      .send({ mediaId: missing.body.mediaId })
      .expect(422);
    const bad = await a.agent
      .post('/v1/dealer/storefront/media/presign')
      .send({ fileName: 'bad.png', mimeType: 'image/png', bytes: 5 })
      .expect(200);
    const url = new URL(bad.body.uploadUrl as string);
    await a.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('wrong'))
      .expect(200);
    await a.agent
      .post('/v1/dealer/storefront/media/commit')
      .send({ mediaId: bad.body.mediaId })
      .expect(422);
  });
});

describe('verified storefront enquiries and authoritative revocation', () => {
  it('routes a consented customer enquiry into the existing inbox with source attribution', async () => {
    const buyer = await customer();
    const ticket = await intent(liveA.slug);
    await h.agent().post('/v1/enquiries/storefront').send({ ticket, consent: true }).expect(401);
    await buyer.post('/v1/enquiries/storefront').send({ ticket, consent: false }).expect(400);
    await buyer
      .post('/v1/enquiries/storefront')
      .send({ ticket, consent: true, dealerId: b.id })
      .expect(400);
    await buyer
      .post('/v1/enquiries/storefront')
      .send({ ticket: `${ticket.slice(0, -2)}ab`, consent: true })
      .expect(401);
    const context = await h.agent().get(`/v1/storefront/enquiry-intent/${ticket}`).expect(200);
    expect(context.body).toMatchObject({
      dealerName: 'Alpha Select',
      returnUrl: `https://${a.hostname}/car/${liveA.slug}`,
    });
    const receipt = await buyer
      .post('/v1/enquiries/storefront')
      .send({ ticket, consent: true, message: 'May I visit the yard?' })
      .expect(201);
    const record = await h.prisma.enquiry.findUniqueOrThrow({
      where: { id: receipt.body.id as string },
    });
    expect(record).toMatchObject({
      dealerId: a.id,
      listingId: liveA.id,
      source: 'DEALER_WEBSITE',
      storefrontHostname: a.hostname,
      consentVersion: 'storefront-enquiry-v1',
    });
    expect(record.consentAt).not.toBeNull();
    const inbox = await a.agent.get('/v1/dealer/enquiries').expect(200);
    expect(inbox.body.data.find((row: { id: string }) => row.id === record.id)).toMatchObject({
      sourceLabel: 'Dealer website',
      storefrontHostname: a.hostname,
    });
    expect(
      (await b.agent.get('/v1/dealer/enquiries')).body.data.some(
        (row: { id: string }) => row.id === record.id,
      ),
    ).toBe(false);
    await buyer.post('/v1/enquiries/storefront').send({ ticket, consent: true }).expect(409);
    const concurrentCar = await car(a);
    const concurrentTicket = await intent(concurrentCar.slug);
    const submissions = await Promise.all([
      buyer.post('/v1/enquiries/storefront').send({ ticket: concurrentTicket, consent: true }),
      buyer.post('/v1/enquiries/storefront').send({ ticket: concurrentTicket, consent: true }),
    ]);
    expect(submissions.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await h.prisma.enquiry.count({ where: { listingId: concurrentCar.id } })).toBe(1);
    await h.proveNumber(a.agent, '9840099993');
    await a.agent.post('/v1/enquiries/storefront').send({ ticket, consent: true }).expect(422);
    await h
      .agent()
      .post('/v1/storefront/enquiry-intent')
      .set('x-dd-storefront-secret', SECRET)
      .set('x-dd-storefront-host', a.hostname)
      .send({ listingSlug: liveB.slug })
      .expect(404);
  });
  it('refuses an old form after a vehicle is sold', async () => {
    const ticket = await intent(liveB.slug, b);
    await h.prisma.listing.update({ where: { id: liveB.id }, data: { status: 'SOLD' } });
    await h.agent().get(`/v1/storefront/enquiry-intent/${ticket}`).expect(404);
    await publicGet(`/cars/${liveB.slug}`, b).expect(404);
  });
  it('disables immediately without deleting records or returning another tenant', async () => {
    await a.agent.put('/v1/dealer/storefront/enabled').send({ enabled: false }).expect(200);
    await publicGet('/site').expect(404);
    await publicGet('/cars').expect(404);
    await h.agent().get(`/media/by-media/${logoId}/640.webp`).expect(404);
    expect(await h.prisma.dealerStorefront.count({ where: { dealerId: a.id } })).toBe(1);
    const preview = await a.agent.get('/v1/dealer/storefront/preview').expect(200);
    expect(preview.body.site.name).toBe('Alpha Select');
    await a.agent.put('/v1/dealer/storefront/enabled').send({ enabled: true }).expect(200);
  });
  it('refuses suspended and closed dealers for public and private access', async () => {
    for (const status of ['SUSPENDED', 'CLOSED'] as const) {
      await h.prisma.dealer.update({ where: { id: a.id }, data: { status } });
      await publicGet('/site').expect(404);
      await publicGet('/cars').expect(404);
      await a.agent.patch('/v1/dealer/storefront').send({ theme: 'DARK' }).expect(401);
      await h.agent().get(`/media/by-media/${logoId}/640.webp`).expect(404);
    }
    await h.prisma.dealer.update({ where: { id: a.id }, data: { status: 'ACTIVE' } });
  });

  it('requires deliberate website reactivation after administrative suspension', async () => {
    const admin = h.agent();
    h.google.claims = {
      subject: `storefront-admin-${stamp}`,
      email: env.adminAllowlist[0]!,
      name: 'Synthetic admin',
      emailVerified: true,
    };
    await h.signInAdmin(admin);
    await admin
      .post(`/v1/admin/dealers/${a.id}/suspend`)
      .send({ reason: 'Synthetic security test' })
      .expect(200);
    expect(
      (await h.prisma.dealerStorefront.findUniqueOrThrow({ where: { dealerId: a.id } })).status,
    ).toBe('SUSPENDED');
    await publicGet('/site').expect(404);
    await admin
      .post(`/v1/admin/dealers/${a.id}/reinstate`)
      .send({ note: 'Synthetic review completed' })
      .expect(200);
    await publicGet('/site').expect(404);
    const reopened = await a.agent
      .put('/v1/dealer/storefront/enabled')
      .send({ enabled: true })
      .expect(200);
    expect(reopened.body.storefront.status).toBe('ACTIVE');
  });
  it('refuses revoked membership and expired sessions on the next request', async () => {
    await h.prisma.dealerMember.updateMany({
      where: { dealerId: a.id, userId: a.userId },
      data: { status: 'REMOVED' },
    });
    await a.agent.get('/v1/dealer/storefront').expect(401);
    await a.agent.patch('/v1/dealer/storefront').send({ theme: 'DARK' }).expect(401);
    await h.prisma.dealerMember.updateMany({
      where: { dealerId: a.id, userId: a.userId },
      data: { status: 'ACTIVE' },
    });
    await h.prisma.session.updateMany({
      where: { userId: a.userId },
      data: { expiresAt: new Date(0) },
    });
    await a.agent.get('/v1/dealer/storefront').expect(401);
  });
});
