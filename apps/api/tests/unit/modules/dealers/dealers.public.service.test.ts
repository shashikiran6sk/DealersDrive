import type { DealerDirectoryQuery } from '@dealers-drive/contracts';
import { describe, expect, it, vi } from 'vitest';

import { env } from '../../../../src/config/env.js';
import {
  createDealersPublicService,
  noInventoryYet,
  type DealerInventoryStats,
} from '../../../../src/modules/dealers/dealers.public.service.js';
import type { DealersRepository } from '../../../../src/modules/dealers/dealers.repository.js';
import { NotFoundError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/dealers/dealers.public.service.ts`.
 *
 * A8–A9, and the rule that governs both: **nothing here returns a phone
 * number** — A7 (`reveal-contact`) is the only route that can. The public
 * profile has to say "Tap to reveal" and carry no digits at all, which is
 * asserted by scanning the whole serialised payload rather than by checking
 * named fields, because a field added later would slip past the named check.
 *
 * The response-time label is the other thing worth isolating: §14.3 makes a
 * dealer who never touches their inbox degrade their own public stat, and every
 * bucket boundary of that ladder is exercised below.
 *
 * ── Divergences from the baseline's version of this file ────────────────────
 *   · The stats dependency is `DealerInventoryStats`, not the search
 *     repository — see the note on that interface. `noInventoryYet` is what the
 *     container passes until **F076**, and it has its own test here.
 *   · `city` and `state` are columns on the dealership, not a joined `cities`
 *     row (**D6**), so the baseline's "defaults the state to Tamil Nadu" case
 *     is gone: there is no row to default from, and a dealership in Bengaluru
 *     is no longer described as being in Tamil Nadu.
 *   · Directions are `address.mapsUrl` — the link the dealer pasted (**R6**) —
 *     rather than a URL composed from a town's coordinates.
 * ────────────────────────────────────────────────────────────────────────────
 */
function activeDealer(overrides: Record<string, unknown> = {}) {
  return {
    id: '3c8f2b10-2222-4000-8000-000000000002',
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    initials: 'SL',
    cityName: 'Vellore',
    citySlug: 'vellore',
    districtName: 'Vellore',
    districtSlug: 'vellore',
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
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
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
    /** Media ids whose bytes are actually servable — everything else is not. */
    ready?: string[];
  } = {},
) {
  const readyIdQueries: string[][] = [];

  const repo = {
    listActive: () => Promise.resolve(options.dealers ?? []),
    findPublicBySlug: () => Promise.resolve(options.profile ?? null),
    readyMediaIds: (ids: string[]) => {
      readyIdQueries.push(ids);
      return Promise.resolve(new Set(ids.filter((id) => (options.ready ?? []).includes(id))));
    },
  } as unknown as DealersRepository;

  const stats: DealerInventoryStats = {
    dealerStats: () => Promise.resolve(options.stats ?? []),
  };

  return { service: createDealersPublicService({ repo, stats }), readyIdQueries };
}

/** Two uploads, so "only the page's covers" can be told from "every cover". */
const COVER = '9f1c0a44-1111-4000-8000-00000000000a';
const OTHER = '9f1c0a44-1111-4000-8000-00000000000b';

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
    // would make the network look smaller than it is — and until F064 that is
    // every dealership on the platform.
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

  /**
   * The baseline composed this line inline and produced ", Tamil Nadu · 1
   * years" for a dealership with no city — a string a buyer reads, with a
   * leading comma and a plural on one.
   */
  it('degrades the tenure line rather than producing a ragged one', async () => {
    const noCity = setup({ dealers: [activeDealer({ cityName: null, state: null })] });
    const oneYear = setup({ dealers: [activeDealer({ yearsOperating: 1 })] });

    expect((await noCity.service.directory(query())).data[0]?.yearsLabel).toBe('17 years');
    expect((await oneYear.service.directory(query())).data[0]?.yearsLabel).toBe(
      'Vellore, Tamil Nadu · 1 year',
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

  /**
   * The chips are toggles, so the filter is a set. A buyer working the Vellore
   * belt is looking at Katpadi *and* Vellore — twenty minutes apart — and
   * single-select made them run the same search twice.
   */
  it('filters by several cities at once', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'velavan-cars', citySlug: 'katpadi' }),
        activeDealer({ slug: 'arcot-autos', citySlug: 'arcot' }),
      ],
    });

    const response = await h.service.directory(query({ city: 'vellore,katpadi' }));

    expect(response.data.map((card) => card.slug).sort()).toEqual([
      'sri-lakshmi-motors',
      'velavan-cars',
    ]);
  });

  /**
   * Defence in depth, not a user path: `DealerDirectoryQuery` is `.strict()`
   * and its pattern refuses `vellore,,katpadi` with a 400 naming `query.city`,
   * so a request shaped like this never reaches the service through the route.
   * It is asserted anyway because the service is called directly by tests and
   * will be called directly by F076, and a filter that silently matched a town
   * named `''` would match nothing while looking like it matched everything.
   */
  it('ignores whitespace and empty entries if it is ever handed them', async () => {
    const h = setup({
      dealers: [activeDealer(), activeDealer({ slug: 'velavan-cars', citySlug: 'katpadi' })],
    });

    expect((await h.service.directory(query({ city: ' vellore , ,katpadi' }))).data).toHaveLength(
      2,
    );
  });

  it('treats "all" as no city filter', async () => {
    const h = setup({
      dealers: [activeDealer(), activeDealer({ slug: 'velavan-cars', citySlug: 'katpadi' })],
    });

    expect((await h.service.directory(query({ city: 'all' }))).data).toHaveLength(2);
  });

  /**
   * A district is the area a buyer drives across; a city is a town they name.
   * The towns inside one give no hint they are related — Arakkonam and
   * Walajapet share a district with Arcot and with nothing else — which is why
   * the header asks the wider question and the chips the narrower one.
   */
  it('filters by district, across towns that do not look related', async () => {
    const h = setup({
      dealers: [
        activeDealer({ slug: 'arcot-autos', citySlug: 'arcot', districtSlug: 'ranipet' }),
        activeDealer({ slug: 'arakkonam-cars', citySlug: 'arakkonam', districtSlug: 'ranipet' }),
        activeDealer(),
      ],
    });

    const response = await h.service.directory(query({ district: 'ranipet' }));

    expect(response.data.map((card) => card.slug).sort()).toEqual([
      'arakkonam-cars',
      'arcot-autos',
    ]);
  });

  it('narrows the chips to the chosen district', async () => {
    const h = setup({
      dealers: [
        activeDealer({ slug: 'arcot-autos', citySlug: 'arcot', cityName: 'Arcot' }),
        activeDealer({
          slug: 'arcot-autos-2',
          citySlug: 'arcot',
          cityName: 'Arcot',
          districtSlug: 'ranipet',
          districtName: 'Ranipet',
        }),
        activeDealer(),
      ],
    });

    // Vellore's chips are the towns in Vellore, and Arcot's Vellore-district
    // namesake is counted there rather than being merged with the Ranipet one.
    const response = await h.service.directory(query({ district: 'vellore' }));

    expect(response.cities.map((chip) => chip.slug).sort()).toEqual(['arcot', 'vellore']);
    expect(response.cities.find((chip) => chip.slug === 'arcot')?.count).toBe(1);
  });

  /**
   * The header's own options, and the one list that is never narrowed: a
   * selector that dropped the districts you did not choose is a selector you
   * cannot get back out of.
   */
  it('offers every district whatever else is filtered', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'b', districtSlug: 'ranipet', districtName: 'Ranipet' }),
      ],
    });

    const response = await h.service.directory(query({ district: 'vellore', city: 'vellore' }));

    expect(response.districts.map((chip) => chip.slug).sort()).toEqual(['ranipet', 'vellore']);
  });

  it('leaves a dealership with no district out of the selector', async () => {
    const h = setup({
      dealers: [activeDealer({ districtSlug: null, districtName: null })],
    });

    expect((await h.service.directory(query())).districts).toEqual([]);
  });

  /** Two places of the same size must not swap rows between requests. */
  it('orders places busiest first, then alphabetically', async () => {
    const h = setup({
      dealers: [
        activeDealer({ slug: 'a', citySlug: 'zeta', cityName: 'Zeta' }),
        activeDealer({ slug: 'b', citySlug: 'alpha', cityName: 'Alpha' }),
        activeDealer({ slug: 'c', citySlug: 'busiest', cityName: 'Busiest' }),
        activeDealer({ slug: 'd', citySlug: 'busiest', cityName: 'Busiest' }),
      ],
    });

    expect((await h.service.directory(query())).cities.map((chip) => chip.name)).toEqual([
      'Busiest',
      'Alpha',
      'Zeta',
    ]);
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

  /**
   * The chips are counted over every ACTIVE dealership, not over the filtered
   * set — otherwise choosing a chip would leave only that chip on screen, and
   * there would be no way back to the others.
   */
  it('keeps every chip visible once one is chosen', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'b', citySlug: 'katpadi', cityName: 'Katpadi' }),
      ],
    });

    expect((await h.service.directory(query({ city: 'vellore' }))).cities).toHaveLength(2);
  });

  it('returns no phone number on any card', async () => {
    const h = setup({ dealers: [activeDealer({ contactPhone: '9840012345' })] });

    const response = await h.service.directory(query());

    expect(JSON.stringify(response)).not.toMatch(/\b[6-9]\d{9}\b/);
  });

  /**
   * The yard photograph, which is the first thing a buyer sees of a dealership.
   *
   * It is addressed by **media id and width**, never by storage key — so the
   * URL on a page a CDN cached five minutes ago survives the bucket being
   * reorganised underneath it (`platform/media/urls.ts`).
   */
  it('addresses the yard photograph by media id, not by storage key', async () => {
    const h = setup({
      dealers: [activeDealer({ coverMediaId: COVER })],
      ready: [COVER],
    });

    const card = (await h.service.directory(query())).data[0];

    expect(card?.coverUrl).toBe(`${env.MEDIA_BASE_URL}/by-media/${COVER}/640.webp`);
    expect(card?.coverUrl).not.toContain('dealers/');
  });

  /**
   * A `coverMediaId` is a pointer, and the row it points at may not be
   * servable: an upload that never completed is PENDING, a displaced one is
   * ORPHAN, and `media.serve()` refuses both. Emitting a URL for either is a
   * broken image on the card, where `ImageSlot` is the more honest answer.
   */
  it('shows no cover for an upload that is not ready to be served', async () => {
    const h = setup({ dealers: [activeDealer({ coverMediaId: COVER })], ready: [] });

    expect((await h.service.directory(query())).data[0]?.coverUrl).toBeNull();
  });

  it('shows no cover for a dealership that never uploaded one', async () => {
    const h = setup({ dealers: [activeDealer({ coverMediaId: null })] });

    expect((await h.service.directory(query())).data[0]?.coverUrl).toBeNull();
  });

  /**
   * One query for the page, and only for the page.
   *
   * The directory reads every ACTIVE dealership in order to count the city
   * chips; the covers are needed for the 12 rows actually being rendered. Asking
   * about all of them would grow with the platform for no visible benefit, and
   * asking per card would be twelve round trips.
   */
  it('asks about the covers on the page, not about every dealership', async () => {
    const h = setup({
      dealers: [
        activeDealer({ slug: 'a', coverMediaId: COVER }),
        activeDealer({ slug: 'b', coverMediaId: OTHER }),
      ],
      ready: [COVER, OTHER],
    });

    await h.service.directory(query({ limit: 1 }));

    expect(h.readyIdQueries).toEqual([[COVER]]);
  });

  /** Nothing writes `logoMediaId`, so there is no image to address. */
  it('carries no logo URL, because nothing uploads one', async () => {
    const h = setup({ dealers: [activeDealer()] });

    expect((await h.service.directory(query())).data[0]?.logoUrl).toBeNull();
  });
});

/**
 * A12 — the header's list, on every public page.
 *
 * Its own read rather than a slice of the directory's, because the header is in
 * the public layout: it renders on the home page and on the catalogue, neither
 * of which has any reason to fetch a page of dealerships.
 */
describe('locations', () => {
  it('answers with the districts dealerships are actually in, counted', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'b', districtSlug: 'ranipet', districtName: 'Ranipet' }),
        activeDealer({ slug: 'c', districtSlug: 'ranipet', districtName: 'Ranipet' }),
      ],
    });

    const locations = await h.service.locations();

    expect(locations.districts).toEqual([
      { slug: 'ranipet', name: 'Ranipet', count: 2 },
      { slug: 'vellore', name: 'Vellore', count: 1 },
    ]);
  });

  /** The "All districts" row is a count, not an escape hatch with no number. */
  it('counts every ACTIVE dealership, including the ones with no district', async () => {
    const h = setup({
      dealers: [
        activeDealer(),
        activeDealer({ slug: 'b', districtSlug: null, districtName: null }),
      ],
    });

    const locations = await h.service.locations();

    expect(locations.total).toBe(2);
    expect(locations.districts).toHaveLength(1);
  });

  it('is empty rather than absent on a platform with no dealerships', async () => {
    const h = setup({ dealers: [] });

    expect(await h.service.locations()).toEqual({ districts: [], total: 0 });
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

  /**
   * R6. The link the dealer pasted, verbatim — never composed from the address.
   * A typed street address is several pins in one district, and the buyer who
   * follows the wrong one has already driven there.
   */
  it('passes the dealer’s own Maps link straight through', async () => {
    const h = setup({ profile: publicDealer() });

    expect((await h.service.profile('x')).address.mapsUrl).toBe(
      'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    );
  });

  it('offers no Maps link for a dealership that predates the question', async () => {
    const h = setup({ profile: publicDealer({ mapsUrl: null }) });
    const profile = await h.service.profile('x');

    expect(profile.address.mapsUrl).toBeNull();
    // And nothing was invented from the address to fill the gap.
    expect(JSON.stringify(profile)).not.toContain('maps.google');
    expect(JSON.stringify(profile)).not.toContain('/maps/dir/');
  });

  /**
   * The one exception, and it is narrow. An **embed** URL draws a fine map but
   * opens, as a link, as a bare embedded map — no place card, no directions,
   * no "open in the app". So when that is what was pasted, the button is built
   * from the dealership's own pin, which is the pin that very URL contains.
   *
   * This is not the thing R6 forbids. R6 is about not composing a destination
   * out of a *typed address*; these coordinates came from the dealer's link.
   */
  it('turns a pasted embed link into a directions link, using its own pin', async () => {
    const h = setup({
      profile: publicDealer({
        mapsUrl: 'https://www.google.com/maps/embed?pb=!1m18!2d79.1453092!3d12.9346947!5e0',
        lat: 12.9346947,
        lng: 79.1453092,
      }),
    });

    const address = (await h.service.profile('x')).address;

    expect(address.mapsUrl).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12.9346947,79.1453092',
    );
    // The map itself is unaffected — it draws from the pin either way.
    expect(address.geo).toEqual({ lat: 12.9346947, lng: 79.1453092 });
  });

  it('leaves an embed link alone when there is no pin to rebuild it from', async () => {
    // Nothing is invented: a link that goes somewhere beats one that does not.
    const embed = 'https://www.google.com/maps/embed?pb=!1m18!5e0';
    const h = setup({ profile: publicDealer({ mapsUrl: embed, lat: null, lng: null }) });

    expect((await h.service.profile('x')).address.mapsUrl).toBe(embed);
  });

  it('leaves an ordinary share link alone even when the pin is known', async () => {
    const h = setup({ profile: publicDealer({ lat: 12.9165, lng: 79.1325 }) });

    expect((await h.service.profile('x')).address.mapsUrl).toBe(
      'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    );
  });

  it('carries the district beside the city', async () => {
    const h = setup({ profile: publicDealer({ city: 'Katpadi', district: 'Vellore' }) });

    const address = (await h.service.profile('x')).address;
    expect(address.city).toBe('Katpadi');
    expect(address.district).toBe('Vellore');
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
    // domain's standing. Until F064 that is every dealership — which is right.
    expect((await withCars.service.profile('sri-lakshmi-motors')).seo.isIndexable).toBe(true);
    expect((await without.service.profile('sri-lakshmi-motors')).seo.isIndexable).toBe(false);
  });

  it('builds a canonical URL and a titled SEO block', async () => {
    const h = setup({ profile: publicDealer() });

    const seo = (await h.service.profile('sri-lakshmi-motors')).seo;

    expect(seo.canonical).toBe(`${env.WEB_BASE_URL}/dealers/sri-lakshmi-motors`);
    expect(seo.title).toBe('Sri Lakshmi Motors — used cars in Vellore | Dealers-Drive');
  });

  /**
   * D6: there is no `cities` row to take a state off any more, so a dealership
   * with no locality reads as having none — rather than being described as
   * trading in Tamil Nadu because that is what a five-row table said.
   */
  it('does not invent a state for a dealership with no locality', async () => {
    const h = setup({ profile: publicDealer({ city: null, state: null }) });

    const profile = await h.service.profile('x');
    expect(profile.address.state).toBe('');
    expect(profile.seo.title).toBe('Sri Lakshmi Motors — used cars | Dealers-Drive');
    expect(profile.contact.find((entry) => entry.key === 'city')?.value).toBe('');
  });

  it('derives initials from the brand name', async () => {
    const h = setup({ profile: publicDealer({ brandName: 'Velavan Cars' }) });

    expect((await h.service.profile('x')).initials).toBe('VC');
  });
});

/**
 * The car-count source the container passes until **F076**.
 *
 * Worth its own test because it is the seam: when the search module lands, this
 * is the one argument that changes, and a reader should be able to see exactly
 * what it stands in for.
 */
describe('noInventoryYet', () => {
  it('reports no inventory, for anybody', async () => {
    await expect(noInventoryYet.dealerStats()).resolves.toEqual([]);
  });
});
