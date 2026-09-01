import type { EnquiryStatus, PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { CreateEnquiryInput } from '@dealers-drive/contracts';

import type { DealersRepository } from '../../../../src/modules/dealers/dealers.facade.js';
import type {
  EnquiriesRepository,
  EnquiryWithVehicle,
} from '../../../../src/modules/enquiries/enquiries.repository.js';
import {
  assertEnquiryTransition,
  createEnquiriesService,
  toEnquiryDto,
} from '../../../../src/modules/enquiries/enquiries.service.js';
import type { SearchRepository } from '../../../../src/modules/search/search.facade.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import { ConflictError, NotFoundError, RateLimitError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/enquiries/enquiries.service.ts`.
 *
 * "The lead is the product; everything else is plumbing" (§1.4), so the branches
 * that protect a lead get the attention here:
 *
 *   · the **honeypot**, which must return a normal 201 with a fabricated reference
 *     while writing nothing — a bot that can tell it failed will try again;
 *   · **deduplication**, so tapping Call three times produces one lead;
 *   · the **reveal caps**, which are a spend control as much as an abuse control
 *     because every reveal costs an SMS;
 *   · `contactedAt` being stamped once and never overwritten, since it feeds the
 *     public response-time stat a dealer is judged on (§14.3).
 */
const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';
const VEHICLE = 'c2a64fc2-9a5a-4eec-a5e8-43db000b7851';

function enquiry(overrides: Record<string, unknown> = {}): EnquiryWithVehicle {
  return {
    id: 'enquiry-1',
    reference: 'DD-EN-40001',
    dealerId: DEALER,
    name: 'Anitha R',
    phone: '+919876543210',
    email: 'anitha@example.com',
    message: 'Is the service history available?',
    source: 'LISTING_PAGE',
    status: 'NEW',
    contactedAt: null,
    createdAt: new Date('2026-08-17T10:00:00.000Z'),
    vehicle: {
      id: VEHICLE,
      year: 2021,
      slug: '2021-alto-800-vellore-abc123',
      make: { name: 'Maruti Suzuki' },
      model: { name: 'Alto 800' },
      variant: { name: 'VXI' },
    },
    ...overrides,
  } as unknown as EnquiryWithVehicle;
}

function searchRow(overrides: Record<string, unknown> = {}) {
  return {
    vehicle_id: VEHICLE,
    listing_id: 'listing-1',
    vehicle_slug: '2021-alto-800-vellore-abc123',
    title: 'Maruti Suzuki Alto 800 VXI',
    price_paise: 64_500_000n,
    city_name: 'Vellore',
    dealer_slug: 'sri-lakshmi-motors',
    primary_media_id: 'media-1',
    ...overrides,
  };
}

function dealerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DEALER,
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    contactPhone: '+919840012345',
    medianResponseMins: 45,
    ...overrides,
  };
}

interface Options {
  row?: Record<string, unknown> | null;
  dealer?: Record<string, unknown> | null;
  duplicate?: EnquiryWithVehicle | null;
  created?: Record<string, unknown>;
  list?: EnquiryWithVehicle[];
  counts?: Record<EnquiryStatus, number>;
  existing?: Record<string, unknown> | null;
  updated?: Record<string, unknown> | null;
  revealsToday?: number;
  hourlyCap?: number;
  dailyCap?: number;
}

function setup(options: Options = {}) {
  const creates: Record<string, unknown>[] = [];
  const reveals: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const duplicateLookups: unknown[][] = [];

  const repo = {
    nextReference: () => Promise.resolve('DD-EN-40001'),
    create: (_tx: unknown, data: Record<string, unknown>) => {
      creates.push(data);
      return Promise.resolve(enquiry({ ...(options.created ?? {}), ...data }));
    },
    findRecentDuplicate: (...args: unknown[]) => {
      duplicateLookups.push(args);
      return Promise.resolve(options.duplicate ?? null);
    },
    recordReveal: (_tx: unknown, data: Record<string, unknown>) => {
      reveals.push(data);
      return Promise.resolve({});
    },
    revealsToday: () => Promise.resolve(options.revealsToday ?? 0),
    listForDealer: () => Promise.resolve(options.list ?? []),
    countsForDealer: () =>
      Promise.resolve(options.counts ?? { NEW: 0, CONTACTED: 0, CLOSED: 0, SPAM: 0 }),
    findForDealer: () =>
      Promise.resolve(options.existing === null ? null : enquiry(options.existing ?? {})),
    updateForDealer: (_dealerId: string, _id: string, data: Record<string, unknown>) => {
      updates.push(data);
      return Promise.resolve(
        options.updated === null ? null : enquiry({ ...(options.updated ?? {}), ...data }),
      );
    },
    recentForDealer: () => Promise.resolve([enquiry()]),
  } as unknown as EnquiriesRepository;

  const tx = {
    outboxEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        outbox.push(args.data);
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
  } as unknown as PrismaClient;

  const dealers = {
    findPublicBySlug: () =>
      Promise.resolve(options.dealer === null ? null : dealerRow(options.dealer ?? {})),
  } as unknown as DealersRepository;

  const search = {
    byVehicleId: () => Promise.resolve(options.row === null ? null : searchRow(options.row ?? {})),
  } as unknown as SearchRepository;

  const config = {
    number: (key: string) =>
      Promise.resolve(
        key === 'reveal.hourlyCapPerIp' ? (options.hourlyCap ?? 10) : (options.dailyCap ?? 20),
      ),
    boolean: () => Promise.resolve(false),
    stringList: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    set: () => Promise.reject(new Error('not used')),
    flag: () => Promise.resolve(false),
    flags: () => Promise.resolve({}),
    invalidate: () => Promise.resolve(),
  } as unknown as PlatformConfigService;

  // A fresh counter per setup(), so one test's exhausted reveal window is not
  // the next one's starting state.
  const cache = createMemoryCache();

  return {
    service: createEnquiriesService({ prisma, repo, dealers, search, config, cache }),
    creates,
    reveals,
    outbox,
    updates,
    duplicateLookups,
  };
}

const input = (overrides: Partial<CreateEnquiryInput> = {}): CreateEnquiryInput => ({
  vehicleId: VEHICLE,
  name: 'Anitha R',
  phone: '9876543210',
  message: 'Is the service history available?',
  source: 'LISTING_PAGE',
  ...overrides,
});

const meta = { ip: '203.0.113.9', userAgent: 'Mozilla/5.0' };

// Each `setup()` builds its own counter, so there is nothing global to reset.

describe('create', () => {
  it('records the lead and returns 201 with its reference', async () => {
    const h = setup();

    const result = await h.service.create(input(), meta);

    expect(result.status).toBe(201);
    expect(result.body.reference).toBe('DD-EN-40001');
    expect(result.body.isDuplicate).toBe(false);
    expect(h.creates).toHaveLength(1);
  });

  it('normalises the phone number to E.164', async () => {
    const h = setup();

    await h.service.create(input({ phone: '98765 43210' }), meta);

    // The number is the identity for deduplication, so it has to be stored in one
    // form regardless of how the buyer typed it.
    expect(h.creates[0]?.phone).toBe('+919876543210');
  });

  it('publishes EnquiryCreated in the same transaction', async () => {
    const h = setup();

    await h.service.create(input(), meta);

    // The 30-second notification is the product; it must be exactly as durable as
    // the row it is about.
    expect(h.outbox[0]).toMatchObject({ eventType: 'EnquiryCreated' });
  });

  it('records the source, ip and user agent for abuse analysis', async () => {
    const h = setup();

    await h.service.create(input(), meta);

    expect(h.creates[0]).toMatchObject({
      source: 'LISTING_PAGE',
      ip: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
      status: 'NEW',
    });
  });

  it('stores a null user agent when the client sent none', async () => {
    const h = setup();

    await h.service.create(input(), { ip: '203.0.113.9' });

    expect(h.creates[0]?.userAgent).toBeNull();
  });

  it('normalises an empty email to null', async () => {
    const h = setup();

    await h.service.create(input({ email: '' }), meta);

    // An empty string would make `emailHref` a `mailto:` to nowhere.
    expect(h.creates[0]?.email).toBeNull();
  });

  it('keeps a real email address', async () => {
    const h = setup();

    await h.service.create(input({ email: 'anitha@example.com' }), meta);

    expect(h.creates[0]?.email).toBe('anitha@example.com');
  });

  it('links the enquiry to the live listing', async () => {
    const h = setup();

    await h.service.create(input(), meta);

    expect(h.creates[0]).toMatchObject({ vehicleId: VEHICLE, listingId: 'listing-1' });
  });

  it('returns the car’s details so the confirmation page can render it', async () => {
    const h = setup();

    const result = await h.service.create(input(), meta);

    expect(result.body.vehicle).toMatchObject({
      slug: '2021-alto-800-vellore-abc123',
      title: '2021 Maruti Suzuki Alto 800 VXI',
      priceLabel: '₹6.45 Lakh',
      city: 'Vellore',
    });
    expect(result.body.vehicle?.thumbnailUrl).toContain('media-1');
  });

  it('reports a null thumbnail when the car has no photo', async () => {
    const h = setup({ row: { primary_media_id: null } });

    const result = await h.service.create(input(), meta);

    expect(result.body.vehicle?.thumbnailUrl).toBeNull();
  });

  describe('the honeypot', () => {
    it('returns a normal 201 with a plausible reference and writes nothing', async () => {
      const h = setup();

      const result = await h.service.create(input({ website: 'http://spam.example' }), meta);

      // A bot that can tell it was caught will simply try again with the field
      // left empty.
      expect(result.status).toBe(201);
      expect(result.body.reference).toMatch(/^DD-EN-\d{5}$/);
      expect(h.creates).toEqual([]);
      expect(h.outbox).toEqual([]);
    });

    it('ignores a whitespace-only honeypot, which a real browser may send', async () => {
      const h = setup();

      const result = await h.service.create(input({ website: '   ' }), meta);

      expect(result.status).toBe(201);
      expect(h.creates).toHaveLength(1);
    });

    it('gives away nothing about the dealership in the fake response', async () => {
      const h = setup();

      const result = await h.service.create(input({ website: 'x' }), meta);

      expect(result.body.dealer).toEqual({ slug: '', brandName: '', responseTimeLabel: '' });
      expect(result.body.vehicle).toBeNull();
    });
  });

  describe('deduplication', () => {
    it('returns 200 and the original reference for a repeat within 24 hours', async () => {
      const h = setup({ duplicate: enquiry({ reference: 'DD-EN-39999' }) });

      const result = await h.service.create(input(), meta);

      expect(result.status).toBe(200);
      expect(result.body.reference).toBe('DD-EN-39999');
      expect(result.body.isDuplicate).toBe(true);
    });

    it('sends no second notification for a duplicate', async () => {
      const h = setup({ duplicate: enquiry() });

      await h.service.create(input(), meta);

      // Two SMS for one buyer is how a dealer learns to ignore the channel.
      expect([h.creates, h.outbox]).toEqual([[], []]);
    });

    it('deduplicates on phone, vehicle and dealership together', async () => {
      const h = setup();

      await h.service.create(input(), meta);

      expect(h.duplicateLookups[0]).toEqual(['+919876543210', VEHICLE, DEALER]);
    });
  });

  it('404s a car that has left the catalogue', async () => {
    const h = setup({ row: null });

    await expect(h.service.create(input(), meta)).rejects.toThrow(/no longer listed/);
  });

  it('accepts a dealership-only enquiry with no vehicle', async () => {
    const h = setup({ row: null });

    const result = await h.service.create(
      input({ vehicleId: undefined, dealerSlug: 'sri-lakshmi-motors' }),
      meta,
    );

    expect(result.status).toBe(201);
    expect(h.creates[0]).toMatchObject({ vehicleId: null, listingId: null });
  });

  it('404s when neither a vehicle nor a dealership is named', async () => {
    const h = setup({ row: null });

    await expect(
      h.service.create(input({ vehicleId: undefined, dealerSlug: undefined }), meta),
    ).rejects.toThrow(NotFoundError);
  });

  it('404s a dealership that is not publicly listed', async () => {
    const h = setup({ dealer: null });

    // A suspended dealership must not receive leads.
    await expect(h.service.create(input(), meta)).rejects.toThrow(/not listed/);
  });

  describe('the response-time promise', () => {
    it.each([
      [null, 'usually responds within a day'],
      [10, 'typically responds within an hour'],
      [89, 'typically responds within an hour'],
      [120, 'typically responds within 2 hours'],
      [400, 'typically responds within 7 hours'],
      [1_440, 'typically responds within a day'],
      [5_000, 'typically responds within a day'],
    ])('renders %s minutes as "%s"', async (medianResponseMins, expected) => {
      const h = setup({ dealer: { medianResponseMins } });

      const result = await h.service.create(input(), meta);

      // Never "within 1 hours".
      expect(result.body.dealer.responseTimeLabel).toBe(expected);
    });
  });
});

describe('revealContact', () => {
  it('returns the number, a tel: link and a WhatsApp link', async () => {
    const h = setup();

    const response = await h.service.revealContact(VEHICLE, { name: 'Anitha' }, meta);

    expect(response.phone).toBe('+919840012345');
    expect(response.phoneDisplay).toBe('+91 98400 12345');
    expect(response.callHref).toBe('tel:+919840012345');
    expect(response.whatsappHref).toBe('https://wa.me/919840012345');
  });

  it('records the reveal and creates a lead in the dealer’s inbox', async () => {
    const h = setup();

    await h.service.revealContact(VEHICLE, { name: 'Anitha' }, meta);

    // §14.4: the tap *is* a lead. A reveal that only incremented a counter would
    // lose the buyer.
    expect(h.reveals).toHaveLength(1);
    expect(h.creates[0]).toMatchObject({ source: 'CALL_BUTTON', name: 'Anitha', status: 'NEW' });
    expect(h.outbox[0]).toMatchObject({ eventType: 'PhoneRevealed' });
  });

  it('names an anonymous caller "Caller"', async () => {
    const h = setup();

    await h.service.revealContact(VEHICLE, { name: '   ' }, meta);

    expect(h.creates[0]?.name).toBe('Caller');
  });

  it('names a caller who gave nothing at all', async () => {
    const h = setup();

    await h.service.revealContact(VEHICLE, {}, meta);

    expect(h.creates[0]?.name).toBe('Caller');
  });

  it('deduplicates repeated taps into one lead', async () => {
    const h = setup({ duplicate: enquiry() });

    await h.service.revealContact(VEHICLE, {}, meta);

    // Tapping Call three times produces one lead, not three — but every tap is
    // still recorded as a reveal for abuse analysis.
    expect(h.reveals).toHaveLength(1);
    expect(h.creates).toEqual([]);
    expect(h.outbox).toEqual([]);
  });

  it('reports how many reveals remain today', async () => {
    const h = setup({ revealsToday: 3, dailyCap: 20 });

    expect((await h.service.revealContact(VEHICLE, {}, meta)).revealsRemainingToday).toBe(16);
  });

  it('never reports a negative remaining count', async () => {
    const h = setup({ revealsToday: 0, dailyCap: 0 });

    // A cap of zero would otherwise report −1.
    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(RateLimitError);
  });

  it('enforces the hourly cap per network', async () => {
    const h = setup({ hourlyCap: 2 });

    await h.service.revealContact(VEHICLE, {}, meta);
    await h.service.revealContact(VEHICLE, {}, meta);

    // §9.2: every reveal costs an SMS, so this is a spend control as much as an
    // abuse control.
    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(/last hour/);
  });

  it('reports how long to wait when the hourly cap bites', async () => {
    const h = setup({ hourlyCap: 1 });

    await h.service.revealContact(VEHICLE, {}, meta);

    try {
      await h.service.revealContact(VEHICLE, {}, meta);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('counts the hourly cap per network, not globally', async () => {
    const h = setup({ hourlyCap: 1 });

    await h.service.revealContact(VEHICLE, {}, meta);

    // Two dealerships sharing a showroom's connection would throttle each other
    // if this were global, but two different buyers must not.
    await expect(
      h.service.revealContact(VEHICLE, {}, { ip: '198.51.100.7' }),
    ).resolves.toBeDefined();
  });

  it('enforces the daily cap from persisted rows, not from memory', async () => {
    const h = setup({ revealsToday: 20, dailyCap: 20 });

    // The hourly window lives in process memory; the daily one has to survive a
    // restart, so it is counted from the table.
    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(/Daily limit/);
  });

  it('writes nothing when a cap refuses the request', async () => {
    const h = setup({ revealsToday: 99, dailyCap: 20 });

    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(RateLimitError);
    expect([h.reveals, h.creates]).toEqual([[], []]);
  });

  it('404s a car that has left the catalogue', async () => {
    const h = setup({ row: null });

    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(/no longer listed/);
  });

  it('404s a dealership with no number on file', async () => {
    const h = setup({ dealer: { contactPhone: null } });

    // Better a 404 than revealing an empty string as a phone number.
    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(NotFoundError);
  });

  it('404s a dealership that is no longer public', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.revealContact(VEHICLE, {}, meta)).rejects.toThrow(NotFoundError);
  });
});

describe('listForDealer', () => {
  it('maps rows and reports the cursor only when there is more', async () => {
    const many = setup({
      list: [enquiry({ id: 'a' }), enquiry({ id: 'b' }), enquiry({ id: 'c' })],
    });
    const few = setup({ list: [enquiry()] });

    const paged = await many.service.listForDealer(DEALER, { limit: 2 });
    const last = await few.service.listForDealer(DEALER, { limit: 2 });

    expect(paged.data).toHaveLength(2);
    expect(paged.page).toMatchObject({ hasMore: true });
    expect(paged.page.nextCursor).not.toBeNull();
    expect(last.page).toEqual({ hasMore: false, nextCursor: null });
  });

  it('returns an empty page rather than failing on an empty inbox', async () => {
    const h = setup({ list: [] });

    expect(await h.service.listForDealer(DEALER, { limit: 24 })).toEqual({
      data: [],
      page: { nextCursor: null, hasMore: false },
    });
  });
});

describe('countsForDealer', () => {
  it('returns the four tabs in a fixed order, with a total', async () => {
    const h = setup({ counts: { NEW: 3, CONTACTED: 2, CLOSED: 5, SPAM: 1 } });

    const response = await h.service.countsForDealer(DEALER);

    expect(response.tabs.map((tab) => tab.status)).toEqual(['NEW', 'CONTACTED', 'CLOSED', 'SPAM']);
    expect(response.tabs.map((tab) => tab.count)).toEqual([3, 2, 5, 1]);
    expect(response.total).toBe(11);
  });

  it('labels each tab for display', async () => {
    const h = setup();

    for (const tab of (await h.service.countsForDealer(DEALER)).tabs) {
      expect(tab.label).not.toContain('_');
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });

  it('reports zeroes for an empty inbox', async () => {
    const h = setup();

    const response = await h.service.countsForDealer(DEALER);

    expect(response.total).toBe(0);
    expect(response.tabs).toHaveLength(4);
  });
});

describe('updateForDealer', () => {
  it('moves a new lead to contacted and stamps the time', async () => {
    const h = setup({ existing: { status: 'NEW', contactedAt: null } });

    const response = await h.service.updateForDealer(DEALER, 'enquiry-1', {
      status: 'CONTACTED',
    });

    expect(h.updates[0]).toMatchObject({ status: 'CONTACTED' });
    expect(h.updates[0]?.contactedAt).toBeInstanceOf(Date);
    expect(response.status).toBe('CONTACTED');
  });

  it('never overwrites an existing contactedAt', async () => {
    const first = new Date('2026-08-01T00:00:00.000Z');
    const h = setup({ existing: { status: 'CLOSED', contactedAt: first } });

    await h.service.updateForDealer(DEALER, 'enquiry-1', { status: 'CONTACTED' });

    // §14.3: this feeds the public response-time stat. Re-stamping it on every
    // reopen would let a dealer improve their own rating by clicking.
    expect(h.updates[0]).not.toHaveProperty('contactedAt');
  });

  it('records a close reason, defaulting to OTHER', async () => {
    const withReason = setup({ existing: { status: 'CONTACTED' } });
    const without = setup({ existing: { status: 'CONTACTED' } });

    await withReason.service.updateForDealer(DEALER, 'enquiry-1', {
      status: 'CLOSED',
      closeReason: 'SOLD',
    });
    await without.service.updateForDealer(DEALER, 'enquiry-1', { status: 'CLOSED' });

    expect(withReason.updates[0]).toMatchObject({ closeReason: 'SOLD' });
    expect(without.updates[0]).toMatchObject({ closeReason: 'OTHER' });
    expect(without.updates[0]?.closedAt).toBeInstanceOf(Date);
  });

  it('stamps the time a lead was marked spam', async () => {
    const h = setup({ existing: { status: 'NEW' } });

    await h.service.updateForDealer(DEALER, 'enquiry-1', { status: 'SPAM' });

    expect(h.updates[0]?.markedSpamAt).toBeInstanceOf(Date);
  });

  it('stores a note when one is given, and omits it when blank', async () => {
    const withNote = setup({ existing: { status: 'NEW' } });
    const without = setup({ existing: { status: 'NEW' } });

    await withNote.service.updateForDealer(DEALER, 'enquiry-1', {
      status: 'CONTACTED',
      note: 'Called twice, no answer.',
    });
    await without.service.updateForDealer(DEALER, 'enquiry-1', {
      status: 'CONTACTED',
      note: '',
    });

    expect(withNote.updates[0]?.note).toBe('Called twice, no answer.');
    expect(without.updates[0]).not.toHaveProperty('note');
  });

  it('returns the refreshed tab counts, so the badge cannot go stale', async () => {
    const h = setup({
      existing: { status: 'NEW' },
      counts: { NEW: 2, CONTACTED: 4, CLOSED: 0, SPAM: 0 },
    });

    const response = await h.service.updateForDealer(DEALER, 'enquiry-1', {
      status: 'CONTACTED',
    });

    expect(response.counts).toEqual({ NEW: 2, CONTACTED: 4, CLOSED: 0, SPAM: 0 });
  });

  it('404s an enquiry belonging to another dealership', async () => {
    const h = setup({ existing: null });

    // 404, not 403: a dealer must not learn that another dealer's lead exists.
    await expect(
      h.service.updateForDealer(DEALER, 'enquiry-1', { status: 'CONTACTED' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('404s when the row vanished between the read and the write', async () => {
    const h = setup({ existing: { status: 'NEW' }, updated: null });

    await expect(
      h.service.updateForDealer(DEALER, 'enquiry-1', { status: 'CONTACTED' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses an illegal move without writing', async () => {
    const h = setup({ existing: { status: 'CLOSED' } });

    await expect(h.service.updateForDealer(DEALER, 'enquiry-1', { status: 'NEW' })).rejects.toThrow(
      ConflictError,
    );
    expect(h.updates).toEqual([]);
  });
});

describe('assertEnquiryTransition', () => {
  const statuses: EnquiryStatus[] = ['NEW', 'CONTACTED', 'CLOSED', 'SPAM'];

  const legal: Record<EnquiryStatus, EnquiryStatus[]> = {
    NEW: ['CONTACTED', 'SPAM', 'CLOSED'],
    CONTACTED: ['CLOSED', 'SPAM'],
    CLOSED: ['CONTACTED'],
    SPAM: ['CONTACTED', 'NEW'],
  };

  it('permits exactly the moves the table names', () => {
    for (const from of statuses) {
      for (const to of statuses) {
        if (from === to || legal[from].includes(to)) {
          expect(() => assertEnquiryTransition(from, to), `${from} → ${to}`).not.toThrow();
        } else {
          expect(() => assertEnquiryTransition(from, to), `${from} → ${to}`).toThrow(ConflictError);
        }
      }
    }
  });

  it('treats a no-op as legal, so a double-click is not an error', () => {
    for (const status of statuses) {
      expect(() => assertEnquiryTransition(status, status)).not.toThrow();
    }
  });

  it('refuses to reopen a closed lead as NEW', () => {
    // The inbox badge counts NEW; letting a dealer reset it would make the badge
    // meaningless.
    expect(() => assertEnquiryTransition('CLOSED', 'NEW')).toThrow(/cannot move/);
  });

  it('allows a mistaken spam mark to be undone', () => {
    expect(() => assertEnquiryTransition('SPAM', 'NEW')).not.toThrow();
    expect(() => assertEnquiryTransition('SPAM', 'CONTACTED')).not.toThrow();
  });

  it('names both states in human words', () => {
    try {
      assertEnquiryTransition('CLOSED', 'SPAM');
      expect.unreachable();
    } catch (error) {
      const detail = (error as ConflictError).detail;
      expect(detail).not.toMatch(/[A-Z]{3,}/);
      expect((error as ConflictError).code).toBe('INVALID_TRANSITION');
    }
  });
});

describe('toEnquiryDto', () => {
  it('carries the contact details the dealer acts on', () => {
    const dto = toEnquiryDto(enquiry());

    expect(dto).toMatchObject({
      initials: 'AR',
      phoneDisplay: '+91 98765 43210',
      callHref: 'tel:+919876543210',
      emailHref: 'mailto:anitha@example.com',
    });
  });

  it('reports a null email href when there is no email', () => {
    const dto = toEnquiryDto(enquiry({ email: null }));

    expect(dto.email).toBeNull();
    expect(dto.emailHref).toBeNull();
  });

  it('links to the car when it still has a slug', () => {
    const dto = toEnquiryDto(enquiry());

    expect(dto.vehicle).toEqual({
      id: VEHICLE,
      title: '2021 Maruti Suzuki Alto 800 VXI',
      href: '/car/2021-alto-800-vellore-abc123',
    });
  });

  it('reports a null vehicle for a dealership-only enquiry', () => {
    expect(toEnquiryDto(enquiry({ vehicle: null })).vehicle).toBeNull();
  });

  it('reports a null vehicle when the car has no slug yet', () => {
    // A draft that was never published has no slug, so there is nowhere to link.
    const dto = toEnquiryDto(
      enquiry({
        vehicle: {
          id: VEHICLE,
          year: 2021,
          slug: null,
          make: { name: 'M' },
          model: { name: 'A' },
          variant: null,
        },
      }),
    );

    expect(dto.vehicle).toBeNull();
  });

  it('offers the actions each status allows', () => {
    const cases: [EnquiryStatus, string[]][] = [
      ['NEW', ['CONTACT', 'EMAIL', 'MARK_CONTACTED', 'CLOSE', 'SPAM']],
      ['CONTACTED', ['CONTACT', 'EMAIL', 'CLOSE', 'SPAM']],
      ['CLOSED', ['CONTACT', 'EMAIL', 'REOPEN']],
      ['SPAM', ['CONTACT', 'EMAIL', 'REOPEN']],
    ];

    for (const [status, actions] of cases) {
      expect(toEnquiryDto(enquiry({ status })).actions, status).toEqual(actions);
    }
  });

  it('omits the email action when there is no address', () => {
    expect(toEnquiryDto(enquiry({ email: null })).actions).not.toContain('EMAIL');
  });

  it('labels the source in words', () => {
    const dto = toEnquiryDto(enquiry({ source: 'CALL_BUTTON' }));

    expect(dto.sourceLabel).not.toContain('_');
    expect(dto.sourceLabel.length).toBeGreaterThan(0);
  });

  it('reports both an absolute timestamp and a relative label', () => {
    const dto = toEnquiryDto(enquiry());

    expect(dto.createdAt).toBe('2026-08-17T10:00:00.000Z');
    expect(dto.timeAgoLabel.length).toBeGreaterThan(0);
  });
});

describe('recentForDealer', () => {
  it('delegates to the repository', async () => {
    const h = setup();

    expect(await h.service.recentForDealer(DEALER, 4)).toHaveLength(1);
  });
});
