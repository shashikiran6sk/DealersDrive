import type {
  AdminEnquiriesResponse,
  AdminEnquiryDetail,
  DealerEnquiriesResponse,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { encodeKeysetCursor } from '../src/platform/pagination.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R89 — admin oversight of enquiries.
 *
 * The enquiries an operator reads are the very rows the dealership's inbox and
 * the customer's page read — so the suite drives a real customer, a real
 * dealership and a real admin through the real guards, and asserts that the
 * admin sees the same enquiry, can narrow to it, and can change nothing.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let b: Dealership;
let counter = 0;
let tokens = 0;

interface Customer {
  agent: request.Agent;
  phone: string;
  id: string;
}

interface Car {
  listingId: string;
  slug: string;
  plate: string;
}

let meera: Customer;
let arjun: Customer;
let carA: Car;
let carB: Car;
let meeraOnA: string;
let arjunOnB: string;

function freeNumber(): string {
  counter += 1;
  return `96377${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string): string {
  tokens += 1;
  return `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:admin-enquiry-${String(tokens)}`;
}

async function customer(fullName: string): Promise<Customer> {
  const agent = h.agent();
  const phone = freeNumber();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: devToken(phone) })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, phone: `+91${phone}`, id: created.body.customer.id as string };
}

async function car(owner: Dealership, make: string, model: string): Promise<Car> {
  counter += 1;
  const plate = `TN31AE${String(1000 + counter)}`;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: plate,
      rtoCode: 'TN31',
      make,
      model,
      variant: 'VX',
      manufacturingYear: 2021,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status: 'ACTIVE',
      slug: `2021-${make.toLowerCase()}-${model.toLowerCase()}-${String(counter)}-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  return { listingId: listing.id, slug: listing.slug ?? '', plate };
}

async function enquire(who: Customer, target: Car, message?: string): Promise<string> {
  const res = await who.agent
    .post('/v1/enquiries')
    .send({ listingSlug: target.slug, ...(message ? { message } : {}) })
    .expect(201);
  return res.body.id as string;
}

async function list(query = ''): Promise<AdminEnquiriesResponse> {
  const res = await admin.get(`/v1/admin/enquiries${query}`).expect(200);
  return res.body as AdminEnquiriesResponse;
}

function ids(page: AdminEnquiriesResponse): string[] {
  return page.data.map((row) => row.id);
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'oversight');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();

  carA = await car(a, 'Honda', 'City');
  carB = await car(b, 'Tata', 'Nexon');
  meera = await customer('Meera Iyer');
  arjun = await customer('Arjun Rao');

  meeraOnA = await enquire(
    meera,
    carA,
    'Is the service history available?\nI can visit on Saturday.',
  );
  arjunOnB = await enquire(arjun, carB);

  await a.agent.patch(`/v1/dealer/enquiries/${meeraOnA}`).send({ status: 'CONTACTED' }).expect(200);
});

afterAll(async () => {
  await h.close();
});

describe('who may look', () => {
  it('refuses a visitor with no session', async () => {
    await h.agent().get('/v1/admin/enquiries').expect(401);
    await h.agent().get(`/v1/admin/enquiries/${meeraOnA}`).expect(401);
  });

  it('refuses a signed-in customer, even about their own enquiry', async () => {
    await meera.agent.get('/v1/admin/enquiries').expect(401);
    await meera.agent.get(`/v1/admin/enquiries/${meeraOnA}`).expect(401);
  });

  it('refuses a dealer, even about an enquiry in their own inbox', async () => {
    await a.agent.get('/v1/admin/enquiries').expect(401);
    await a.agent.get(`/v1/admin/enquiries/${meeraOnA}`).expect(401);
  });

  it('offers an operator no way to change an enquiry', async () => {
    await admin.patch(`/v1/admin/enquiries/${meeraOnA}`).send({ status: 'CLOSED' }).expect(404);
    const row = await h.prisma.enquiry.findUniqueOrThrow({ where: { id: meeraOnA } });
    expect(row.status).toBe('CONTACTED');
  });
});

describe('the list', () => {
  it('shows every dealership’s enquiries, newest first, uncached', async () => {
    const res = await admin.get('/v1/admin/enquiries').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const page = res.body as AdminEnquiriesResponse;

    expect(ids(page).indexOf(arjunOnB)).toBeLessThan(ids(page).indexOf(meeraOnA));
    const row = page.data.find((entry) => entry.id === meeraOnA);
    expect(row).toMatchObject({
      status: 'CONTACTED',
      statusLabel: 'Contacted',
      statusTone: 'ok',
      messagePreview: 'Is the service history available?',
      customer: { id: meera.id, name: 'Meera Iyer', phoneDisplay: expect.stringMatching(/^\+91 /) },
      dealer: { id: a.dealerId, slug: a.slug },
      vehicle: {
        listingId: carA.listingId,
        title: '2021 Honda City VX',
        listingStatus: 'ACTIVE',
        listingStatusLabel: 'Active',
      },
    });
    expect(row?.createdLabel).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/);
    expect(page.data.find((entry) => entry.id === arjunOnB)?.messagePreview).toBeNull();
  });

  it('is the very enquiry the dealership sees, not a copy', async () => {
    const before = await h.prisma.enquiry.count();
    await list();
    expect(await h.prisma.enquiry.count()).toBe(before);

    const inbox = (await a.agent.get('/v1/dealer/enquiries?status=CONTACTED').expect(200))
      .body as DealerEnquiriesResponse;
    expect(inbox.data.map((row) => row.id)).toContain(meeraOnA);
    expect(ids(await list(`?dealer=${a.slug}`))).toContain(meeraOnA);
  });

  it('cuts a long message short in the list, keeping the whole one for the detail', async () => {
    const long = 'Please call me back. '.repeat(20).trim();
    const id = await enquire(arjun, carA, long);
    const row = (await list(`?dealer=${a.slug}`)).data.find((entry) => entry.id === id);
    expect(row?.messagePreview?.length).toBe(120);
    expect(row?.messagePreview?.endsWith('…')).toBe(true);
    const detail = (await admin.get(`/v1/admin/enquiries/${id}`).expect(200))
      .body as AdminEnquiryDetail;
    expect(detail.message).toBe(long);
  });
});

describe('filters and search', () => {
  it('narrows to one status, with counts across every status under the other filters', async () => {
    const contacted = await list(`?status=CONTACTED&dealer=${a.slug}`);
    expect(ids(contacted)).toEqual([meeraOnA]);
    expect(contacted.counts.CONTACTED).toBe(1);
    expect(contacted.counts.ALL).toBe(contacted.counts.NEW + 1);
    expect(contacted.dealer).toEqual({ slug: a.slug, name: expect.stringContaining('oversight') });
  });

  it('narrows to one dealership by slug, and says when no dealership has it', async () => {
    const onlyB = await list(`?dealer=${b.slug}`);
    expect(ids(onlyB)).toEqual([arjunOnB]);

    const nobody = await list('?dealer=no-such-dealership');
    expect(nobody.data).toEqual([]);
    expect(nobody.dealer).toEqual({ slug: 'no-such-dealership', name: null });
    expect(nobody.counts.ALL).toBe(0);
  });

  it.each([
    ['the customer’s name', () => 'meera iy'],
    ['the customer’s mobile number', () => meera.phone.slice(-6)],
    ['the car’s model', () => 'city'],
    ['the plate, however it is spaced', () => carA.plate.replace(/(\d{4})$/, ' $1').toLowerCase()],
  ])('finds an enquiry by %s', async (_label, term) => {
    const page = await list(`?q=${encodeURIComponent(term())}`);
    expect(ids(page)).toContain(meeraOnA);
    expect(ids(page)).not.toContain(arjunOnB);
  });

  it('finds every enquiry at a dealership by its name', async () => {
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: b.dealerId } });
    const page = await list(`?q=${encodeURIComponent(dealer.brandName.toUpperCase())}`);
    expect(ids(page)).toEqual([arjunOnB]);
  });

  it('ignores a blank search, and does not read two digits as a phone number', async () => {
    expect(ids(await list('?q=%20%20'))).toEqual(expect.arrayContaining([meeraOnA, arjunOnB]));
    // Two digits that are in Meera's number but nowhere else on the row. The
    // fixture dealership's name carries a timestamp, and a pair that happened
    // to occur in it would match by name and prove nothing about the phone.
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: a.dealerId } });
    const elsewhere = `${dealer.brandName} ${dealer.slug} ${carA.plate} 2021`;
    const pair =
      [...Array(meera.phone.length - 1).keys()]
        .map((at) => meera.phone.slice(at, at + 2))
        .find((candidate) => /^\d\d$/.test(candidate) && !elsewhere.includes(candidate)) ??
      meera.phone.slice(-2);
    const twoDigits = await list(`?q=${pair}&dealer=${a.slug}`);
    expect(ids(twoDigits)).not.toContain(meeraOnA);
  });

  it('bounds the IST day it was sent, both ends inclusive', async () => {
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    expect(ids(await list(`?from=${today}&to=${today}`))).toContain(meeraOnA);
    expect(ids(await list(`?from=${today}`))).toContain(meeraOnA);
    expect(ids(await list(`?to=${today}`))).toContain(meeraOnA);
    expect((await list('?to=2020-01-01')).data).toEqual([]);
    expect((await list('?from=2099-01-01')).counts.ALL).toBe(0);
  });

  it('refuses a parameter it does not know, and a date that is not one', async () => {
    const unknown = await admin.get('/v1/admin/enquiries?dealerId=abc').expect(400);
    expect(JSON.stringify(unknown.body)).toContain('dealerId');
    await admin.get('/v1/admin/enquiries?from=26-09-2026').expect(400);
    await admin.get('/v1/admin/enquiries?status=OPEN').expect(400);
    await admin.get('/v1/admin/enquiries?limit=500').expect(400);
  });
});

describe('paging', () => {
  it('walks every enquiry once, by keyset, without repeating or skipping', async () => {
    const all = ids(await list('?limit=100'));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: AdminEnquiriesResponse = await list(
        `?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
      );
      seen.push(...ids(page));
      expect(page.page.hasMore).toBe(page.page.nextCursor !== null);
      cursor = page.page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all);
  });

  it('breaks a tie on the time sent by id', async () => {
    const at = new Date('2026-09-01T10:00:00.000Z');
    await h.prisma.enquiry.updateMany({
      where: { id: { in: [meeraOnA, arjunOnB] } },
      data: { createdAt: at },
    });
    const [first, second] = [meeraOnA, arjunOnB].sort().reverse();
    const page = await list(`?limit=1&cursor=${encodeKeysetCursor(at, first ?? '')}&to=2026-09-01`);
    expect(ids(page)).toEqual([second]);
  });

  it('refuses a cursor it did not issue', async () => {
    const res = await admin.get('/v1/admin/enquiries?cursor=not-a-cursor').expect(409);
    expect(res.body.code).toBe('MALFORMED_CURSOR');
  });
});

describe('one enquiry', () => {
  it('shows the customer, the dealership, the car and the recorded history', async () => {
    const res = await admin.get(`/v1/admin/enquiries/${meeraOnA}`).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const detail = res.body as AdminEnquiryDetail;

    expect(detail).toMatchObject({
      id: meeraOnA,
      status: 'CONTACTED',
      customerStatusLabel: 'Contacted',
      message: 'Is the service history available?\nI can visit on Saturday.',
      closedLabel: null,
      customer: { id: meera.id, name: 'Meera Iyer', phone: meera.phone, phoneVerified: true },
      dealer: { id: a.dealerId, slug: a.slug, adminHref: `/admin/dealers/${a.dealerId}` },
      vehicle: {
        listingId: carA.listingId,
        listingStatus: 'ACTIVE',
        image: null,
        publicHref: `/car/${carA.slug}`,
        adminHref: `/admin/listings/${carA.listingId}`,
      },
    });
    expect(detail.contactedLabel).not.toBeNull();
    expect(
      detail.history.map((entry) => [entry.label, entry.actor, entry.fromStatus, entry.toStatus]),
    ).toEqual([
      ['Enquiry sent', 'Customer', null, 'NEW'],
      ['Marked contacted', 'Dealer', 'NEW', 'CONTACTED'],
    ]);
  });

  it('shows spam as the dealer marked it, and closed as the customer sees it', async () => {
    await b.agent.patch(`/v1/dealer/enquiries/${arjunOnB}`).send({ status: 'SPAM' }).expect(200);
    const detail = (await admin.get(`/v1/admin/enquiries/${arjunOnB}`).expect(200))
      .body as AdminEnquiryDetail;
    expect(detail).toMatchObject({
      statusLabel: 'Spam',
      customerStatusLabel: 'Closed',
      message: null,
    });
    expect(detail.history.at(-1)).toMatchObject({
      label: 'Marked as spam',
      fromStatus: 'NEW',
      toStatus: 'SPAM',
    });
  });

  it('keeps the enquiry, and its history, after the car is sold', async () => {
    await h.prisma.listing.update({ where: { id: carA.listingId }, data: { status: 'SOLD' } });
    const detail = (await admin.get(`/v1/admin/enquiries/${meeraOnA}`).expect(200))
      .body as AdminEnquiryDetail;
    expect(detail.vehicle).toMatchObject({
      listingStatus: 'SOLD',
      listingStatusLabel: 'Sold',
      publicHref: null,
      adminHref: `/admin/listings/${carA.listingId}`,
    });
    expect(detail.history).toHaveLength(2);
    expect(ids(await list('?status=CONTACTED'))).toContain(meeraOnA);
  });

  it('shows the primary photograph when the car has one', async () => {
    const vehicle = await h.prisma.listing.findUniqueOrThrow({ where: { id: carA.listingId } });
    const media = await h.prisma.media.create({
      data: {
        ownerType: 'VEHICLE',
        storageKey: `test/oversight-${Date.now()}.webp`,
        mimeType: 'image/webp',
        bytes: 1024,
        status: 'READY',
      },
    });
    await h.prisma.vehicleMedia.create({
      data: {
        vehicleId: vehicle.vehicleId,
        mediaId: media.id,
        position: 0,
        isPrimary: true,
        addedBy: meera.id,
      },
    });
    const detail = (await admin.get(`/v1/admin/enquiries/${meeraOnA}`).expect(200))
      .body as AdminEnquiryDetail;
    expect(detail.vehicle.image).toEqual({
      url: expect.stringContaining(`/by-media/${media.id}/640.webp`),
      alt: 'Photograph of the 2021 Honda City VX',
    });
  });

  it('never invents history for an enquiry the trail has nothing on', async () => {
    const quiet = await h.prisma.enquiry.create({
      data: {
        customerId: meera.id,
        dealerId: b.dealerId,
        listingId: carB.listingId,
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
    const detail = (await admin.get(`/v1/admin/enquiries/${quiet.id}`).expect(200))
      .body as AdminEnquiryDetail;
    expect(detail.history).toEqual([]);
    expect(detail.closedLabel).not.toBeNull();
  });

  it('answers 404 for an enquiry that does not exist, and 400 for an id that is not one', async () => {
    const missing = await admin
      .get('/v1/admin/enquiries/00000000-0000-4000-8000-000000000000')
      .expect(404);
    expect(missing.body.code).toBe('ENQUIRY_NOT_FOUND');
    await admin.get('/v1/admin/enquiries/not-an-id').expect(400);
  });
});
