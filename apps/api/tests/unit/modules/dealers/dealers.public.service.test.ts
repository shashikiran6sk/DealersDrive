import { describe, expect, it, vi } from 'vitest';

import type { DealerDirectoryQuery } from '@dealers-drive/contracts';

import { env } from '../../../../src/config/env.js';
import { createDealersPublicService } from '../../../../src/modules/dealers/dealers.public.service.js';
import type { DealersRepository } from '../../../../src/modules/dealers/dealers.repository.js';
import type { SearchRepository } from '../../../../src/modules/search/search.facade.js';
import { NotFoundError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/dealers/dealers.public.service.ts`.
 *
 * A8–A11, and the rule that governs all of them: **nothing here returns a phone
 * number** — A7 (`reveal-contact`) is the only route that can. The public profile
 * has to say "Tap to reveal" and carry no digits at all, which is asserted by
 * scanning the whole serialised payload rather than by checking named fields.
 *
 * The response-time label is the other thing worth isolating: §14.3 makes a
 * dealer who never touches their inbox degrade their own public stat, and every
 * bucket boundary of that ladder is exercised below.
 */
function activeDealer(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    initials: 'SL',
    cityName: 'Vellore',
    citySlug: 'vellore',
    state: 'Tamil Nadu',
    yearsOperating: 17,
    tagline: 'Trusted since 2009',
    specialities: ['Hatchbacks', 'Sedans', 'SUVs', 'Exchange'],
    ...overrides,
  };
}

function publicDealer(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    legalName: 'Sri Lakshmi Motors Pvt Ltd',
    about: 'Family-run dealership in Vellore.',
    specialities: ['Hatchbacks'],
    addressLine: '12 Katpadi Road',
    pincode: '632001',
    city: { name: 'Vellore', state: 'Tamil Nadu' },
    lat: 12.9165,
    lng: 79.1325,
    gstin: '33AABCS1429B1ZX',
    pan: 'AABCS1429B',
    contactPhone: '9840012345',
    establishedYear: 2009,
    medianResponseMins: 45,
    workingHours: { mon_sat: '09:30-19:00', sun: null },
    ...overrides,
  };
}

function setup(
  options: {
    dealers?: Record<string, unknown>[];
    stats?: { dealer_slug: string; count: number; from_price: bigint | null }[];
    profile?: Record<string, unknown> | null;
  } = {},
) {
  const repo = {
    listActive: () => Promise.resolve(options.dealers ?? []),
    findPublicBySlug: () => Promise.resolve(options.profile ?? null),
  } as unknown as DealersRepository;

  const search = {
    dealerStats: () => Promise.resolve(options.stats ?? []),
    cityCounts: () => Promise.resolve([]),
  } as unknown as SearchRepository;

  return { service: createDealersPublicService({ repo, search }) };
}

const query = (overrides: Partial<DealerDirectoryQuery> = {}): DealerDirectoryQuery => ({
  page: 1,
  limit: 12,
  ...overrides,
});

describe('directory', () => {
  it('lists active dealerships with their live car counts', async () => {
    const h = setup({
      dealers: [activeDealer()],
      stats: [{ dealer_slug: 'sri-lakshmi-motors', count: 7, from_price: 22_500_000n }],
    });

    const response = await h.service.directory(query());

    expect(response.data[0]).toMatchObject({
      slug: 'sri-lakshmi-motors',
      brandName: 'Sri Lakshmi Motors',
      carCount: 7,
      fromPricePaise: 22_500_000,
      fromPriceLabel: 'from ₹2.25 Lakh',
      isVerified: true,
    });
  });

  it('keeps a dealership with no live cars, showing an em dash', async () => {
    const h = setup({ dealers: [activeDealer()], stats: [] });

    // A8 is explicit: a dealer with zero live cars still appears. Dropping them
    // would make the network look smaller than it is.
    const card = (await h.service.directory(query())).data[0];
    expect(card?.carCount).toBe(0);
    expect(card?.fromPricePaise).toBeNull();
    expect(card?.fromPriceLabel).toBe('—');
  });

  it('shows an em dash when the index has a row but no cheapest price', async () => {
    const h = setup({
      dealers: [activeDealer()],
      stats: [{ dealer_slug: 'sri-lakshmi-motors', count: 0, from_price: null }],
    });

    expect((await h.service.directory(query())).data[0]?.fromPriceLabel).toBe('—');
  });

  it('shows at most three services on a card', async () => {
    const h = setup({ dealers: [activeDealer()] });

    // The card has room for three; the profile shows them all.
    expect((await h.service.directory(query())).data[0]?.services).toEqual([
      'Hatchbacks',
      'Sedans',
      'SUVs',
    ]);
  });

  it('builds the location-and-tenure line', async () => {
    const h = setup({ dealers: [activeDealer()] });

    expect((await h.service.directory(query())).data[0]?.yearsLabel).toBe(
      'Vellore, Tamil Nadu · 17 years',
    );
  });

  it('renders a dealership with no city as an empty string', async () => {
    const h = setup({ dealers: [activeDealer({ cityName: null })] });

    expect((await h.service.directory(query())).data[0]?.city).toBe('');
  });

  it('filters by city', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'velavan-cars', brandName: 'Velavan Cars', citySlug: 'katpadi' }),
      ],
    });

    const response = await h.service.directory(query({ city: 'katpadi' }));

    expect(response.data.map((card) => card.slug)).toEqual(['velavan-cars']);
    expect(response.page.total).toBe(1);
  });

  it('treats "all" as no city filter', async () => {
    const h = setup({
      dealers: [activeDealer(), activeDealer({ slug: 'velavan-cars', citySlug: 'katpadi' })],
    });

    expect((await h.service.directory(query({ city: 'all' }))).data).toHaveLength(2);
  });

  it('searches brand names case-insensitively', async () => {
    const h = setup({
      dealers: [activeDealer(), activeDealer({ slug: 'velavan-cars', brandName: 'Velavan Cars' })],
    });

    const response = await h.service.directory(query({ q: 'VELAVAN' }));

    expect(response.data.map((card) => card.slug)).toEqual(['velavan-cars']);
  });

  it('matches a substring, so a partial name still finds the dealership', async () => {
    const h = setup({ dealers: [activeDealer()] });

    expect((await h.service.directory(query({ q: 'lakshmi' }))).data).toHaveLength(1);
  });

  it('combines the city and text filters', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'velavan-cars', brandName: 'Velavan Cars', citySlug: 'katpadi' }),
      ],
    });

    expect((await h.service.directory(query({ city: 'vellore', q: 'velavan' }))).data).toHaveLength(
      0,
    );
  });

  it('paginates after filtering, not before', async () => {
    const h = setup({
      dealers: Array.from({ length: 5 }, (_, index) =>
        activeDealer({ slug: `dealer-${index}`, brandName: `Dealer ${index}` }),
      ),
    });

    const page2 = await h.service.directory(query({ page: 2, limit: 2 }));

    expect(page2.data.map((card) => card.slug)).toEqual(['dealer-2', 'dealer-3']);
    expect(page2.page).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('returns an empty page past the end rather than failing', async () => {
    const h = setup({ dealers: [activeDealer()] });

    const response = await h.service.directory(query({ page: 9 }));

    expect(response.data).toEqual([]);
    expect(response.page.total).toBe(1);
  });

  it('labels the count, pluralised', async () => {
    const one = setup({ dealers: [activeDealer()] });
    const many = setup({ dealers: [activeDealer(), activeDealer({ slug: 'b' })] });
    const none = setup({ dealers: [] });

    expect((await one.service.directory(query())).countLabel).toBe('1 verified dealership');
    expect((await many.service.directory(query())).countLabel).toBe('2 verified dealerships');
    expect((await none.service.directory(query())).countLabel).toBe('0 verified dealerships');
  });

  it('offers city chips counted by dealership, busiest first', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'b', citySlug: 'katpadi', cityName: 'Katpadi' }),
        activeDealer({ slug: 'c', citySlug: 'katpadi', cityName: 'Katpadi' }),
      ],
    });

    const response = await h.service.directory(query());

    expect(response.cities).toEqual([
      { slug: 'katpadi', name: 'Katpadi', count: 2 },
      { slug: 'vellore', name: 'Vellore', count: 1 },
    ]);
  });

  it('leaves a dealership with no city out of the chips', async () => {
    const h = setup({ dealers: [activeDealer({ citySlug: null, cityName: null })] });

    expect((await h.service.directory(query())).cities).toEqual([]);
  });

  it('builds the chips from every dealership, not just the current page', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'b', citySlug: 'katpadi', cityName: 'Katpadi' }),
      ],
    });

    // Otherwise the chips would change as the buyer pages through.
    const response = await h.service.directory(query({ limit: 1 }));

    expect(response.data).toHaveLength(1);
    expect(response.cities).toHaveLength(2);
  });

  it('returns no phone number on any card', async () => {
    const h = setup({ dealers: [activeDealer({ contactPhone: '9840012345' })] });

    const response = await h.service.directory(query());

    expect(JSON.stringify(response)).not.toMatch(/\b[6-9]\d{9}\b/);
  });
});

describe('profile', () => {
  it('404s a dealership that is not listed', async () => {
    const h = setup({ profile: null });

    // Covers both "does not exist" and "is suspended" with one answer, so
    // membership is never leaked.
    await expect(h.service.profile('unknown')).rejects.toThrow(NotFoundError);
    await expect(h.service.profile('unknown')).rejects.toThrow(/not listed/);
  });

  it('never returns the phone number', async () => {
    const h = setup({ profile: publicDealer() });

    const profile = await h.service.profile('sri-lakshmi-motors');

    // A7 is the only way to get it, and it is rate-limited and logged because
    // every reveal costs an SMS.
    expect(JSON.stringify(profile)).not.toMatch(/\b[6-9]\d{9}\b/);
    const phone = profile.contact.find((entry) => entry.key === 'phone');
    expect(phone).toMatchObject({ value: 'Tap to reveal', masked: true });
  });

  it('publishes GSTIN but never PAN', async () => {
    const h = setup({ profile: publicDealer() });

    const profile = await h.service.profile('sri-lakshmi-motors');

    // GSTIN is on every Indian invoice; PAN is not public information.
    expect(profile.contact.find((entry) => entry.key === 'gstin')?.value).toBe('33AABCS1429B1ZX');
    // An Indian GSTIN embeds the PAN, so a substring search would always match.
    // What must not appear is a PAN *field* — the number on its own, under any key.
    expect(profile.contact.some((entry) => entry.key === 'pan')).toBe(false);
    expect(profile).not.toHaveProperty('pan');
    expect(profile.contact.some((entry) => String(entry.value) === 'AABCS1429B')).toBe(false);
  });

  it('omits the GSTIN row when there is none', async () => {
    const h = setup({ profile: publicDealer({ gstin: null }) });

    const profile = await h.service.profile('sri-lakshmi-motors');

    expect(profile.contact.some((entry) => entry.key === 'gstin')).toBe(false);
  });

  it('assembles a full postal address', async () => {
    const h = setup({ profile: publicDealer() });

    expect((await h.service.profile('sri-lakshmi-motors')).address.full).toBe(
      '12 Katpadi Road, Vellore 632001, Tamil Nadu',
    );
  });

  it('leaves out the parts of an address it does not have', async () => {
    const h = setup({ profile: publicDealer({ addressLine: null, pincode: null }) });

    const address = (await h.service.profile('sri-lakshmi-motors')).address;

    expect(address.full).toBe('Vellore, Tamil Nadu');
    expect(address.full).not.toContain(', ,');
  });

  it('offers a directions link only when there are coordinates', async () => {
    const located = setup({ profile: publicDealer() });
    const unlocated = setup({ profile: publicDealer({ lat: null, lng: null }) });

    expect((await located.service.profile('x')).address.directionsUrl).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12.9165,79.1325',
    );
    expect((await unlocated.service.profile('x')).address.directionsUrl).toBeNull();
  });

  it('needs both coordinates for a directions link', async () => {
    const h = setup({ profile: publicDealer({ lng: null }) });

    expect((await h.service.profile('x')).address.directionsUrl).toBeNull();
  });

  it('reports four stats, including the live car count', async () => {
    const h = setup({
      profile: publicDealer(),
      stats: [{ dealer_slug: 'sri-lakshmi-motors', count: 7, from_price: null }],
    });

    const stats = await h.service
      .profile('sri-lakshmi-motors')
      .then((profile) => new Map(profile.stats.map((stat) => [stat.key, stat.value])));

    expect(stats.get('cars')).toBe('7');
    expect(stats.get('location')).toBe('Vellore');
  });

  it('derives years operating from the established year', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const h = setup({ profile: publicDealer({ establishedYear: 2009 }) });

    const stats = new Map(
      (await h.service.profile('x')).stats.map((stat) => [stat.key, stat.value]),
    );

    expect(stats.get('years')).toBe('17');
    vi.useRealTimers();
  });

  it('never reports fewer than one year, even for a dealership registered today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const thisYear = setup({ profile: publicDealer({ establishedYear: 2026 }) });
    const unknown = setup({ profile: publicDealer({ establishedYear: null }) });

    // "0 years operating" reads as a defunct business.
    expect(
      (await thisYear.service.profile('x')).stats.find((stat) => stat.key === 'years')?.value,
    ).toBe('1');
    expect(
      (await unknown.service.profile('x')).stats.find((stat) => stat.key === 'years')?.value,
    ).toBe('1');
    vi.useRealTimers();
  });

  describe('the response-time ladder', () => {
    it.each([
      [null, 'New dealer'],
      [5, '< 1 hr'],
      [59, '< 1 hr'],
      [60, '< 2 hrs'],
      [119, '< 2 hrs'],
      [120, '< 2 hrs'],
      [121, '< 3 hrs'],
      [600, '< 10 hrs'],
      [1_439, '< 24 hrs'],
      [1_440, '> 1 day'],
      [10_000, '> 1 day'],
    ])('reports %s minutes as "%s"', async (minutes, expected) => {
      const h = setup({ profile: publicDealer({ medianResponseMins: minutes }) });

      const stats = await h.service
        .profile('x')
        .then((profile) => new Map(profile.stats.map((stat) => [stat.key, stat.value])));

      // §14.3: this is a public stat a dealer degrades by ignoring their inbox,
      // so the buckets have to be honest at the boundaries.
      expect(stats.get('response')).toBe(expected);
    });
  });

  it('renders opening hours in words', async () => {
    const h = setup({ profile: publicDealer({ workingHours: { mon_sat: '09:30-19:00' } }) });

    expect((await h.service.profile('x')).contact.find((e) => e.key === 'hours')?.value).toBe(
      'Mon–Sat, 9:30am – 7pm',
    );
  });

  it('renders a whole hour without ":00"', async () => {
    const h = setup({ profile: publicDealer({ workingHours: { mon_sat: '10:00-18:00' } }) });

    expect((await h.service.profile('x')).contact.find((e) => e.key === 'hours')?.value).toBe(
      'Mon–Sat, 10am – 6pm',
    );
  });

  it('renders midnight and noon as 12', async () => {
    const h = setup({ profile: publicDealer({ workingHours: { mon_sat: '00:00-12:00' } }) });

    expect((await h.service.profile('x')).contact.find((e) => e.key === 'hours')?.value).toBe(
      'Mon–Sat, 12am – 12pm',
    );
  });

  it('omits the hours row when none are recorded', async () => {
    for (const workingHours of [null, {}, { sun: '10:00-14:00' }]) {
      const h = setup({ profile: publicDealer({ workingHours }) });

      expect((await h.service.profile('x')).contact.some((e) => e.key === 'hours')).toBe(false);
    }
  });

  it('survives a malformed hours range', async () => {
    const h = setup({ profile: publicDealer({ workingHours: { mon_sat: '09:30' } }) });

    // Bad data in a jsonb column must not 500 a public page.
    await expect(h.service.profile('x')).resolves.toBeDefined();
  });

  it('is indexable only when the dealership has live inventory', async () => {
    const withCars = setup({
      profile: publicDealer(),
      stats: [{ dealer_slug: 'sri-lakshmi-motors', count: 3, from_price: null }],
    });
    const without = setup({ profile: publicDealer(), stats: [] });

    // §17.2: an empty profile page is a thin page, and thin pages hurt the whole
    // domain's standing.
    expect((await withCars.service.profile('sri-lakshmi-motors')).seo.isIndexable).toBe(true);
    expect((await without.service.profile('sri-lakshmi-motors')).seo.isIndexable).toBe(false);
  });

  it('builds a canonical URL and a titled SEO block', async () => {
    const h = setup({ profile: publicDealer() });

    const seo = (await h.service.profile('sri-lakshmi-motors')).seo;

    expect(seo.canonical).toBe(`${env.WEB_BASE_URL}/dealers/sri-lakshmi-motors`);
    expect(seo.title).toBe('Sri Lakshmi Motors — used cars in Vellore | Dealers-Drive');
  });

  it('defaults the state to Tamil Nadu when the city relation is missing', async () => {
    const h = setup({ profile: publicDealer({ city: null }) });

    expect((await h.service.profile('x')).address.state).toBe('Tamil Nadu');
  });

  it('derives initials from the brand name', async () => {
    const h = setup({ profile: publicDealer({ brandName: 'Velavan Cars' }) });

    expect((await h.service.profile('x')).initials).toBe('VC');
  });
});
