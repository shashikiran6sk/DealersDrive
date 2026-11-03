import {
  NO_VEHICLE_FACETS,
  type PublicLocations,
  type PublicSitemapResponse,
  type PublicVehiclesResponse,
  type VehicleCardDto,
} from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CarsPage from '@/app/(public)/cars/page';
import UsedCarsLandingPage, { generateMetadata } from '@/app/(public)/used-cars/[...segments]/page';
import sitemap from '@/app/sitemap';
import type * as ApiModule from '@/lib/api';
import { NO_PUBLIC_CONFIG } from '@/lib/public-config';

import { LANDING_AT, LANDING_MAP } from '../lib/landing-fixtures';
import { production } from '../lib/seo/env';

vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown,
}));

function card(slug: string, availability: VehicleCardDto['availability'] = 'AVAILABLE') {
  return {
    slug,
    availability,
    title: `2022 Tata Nexon ${slug}`,
    year: 2022,
    priceLabel: '₹9,50,000',
    metaLabel: '32,000 km · Diesel · Manual · Arcot',
    image: { url: `https://media.test/${slug}/1024.webp`, alt: `2022 Tata Nexon ${slug}` },
    imageCount: 6,
    dealer: { name: 'Sri Murugan Cars', slug: 'sri-murugan', initials: 'SM', isVerified: true },
  } satisfies VehicleCardDto;
}

function vehicles(data: VehicleCardDto[], page = 1, totalPages = 1): PublicVehiclesResponse {
  return {
    data,
    page: { page, limit: 24, total: data.length, totalPages },
    available: data.filter((vehicle) => vehicle.availability === 'AVAILABLE').length,
    facets: {
      ...NO_VEHICLE_FACETS,
      dealers: [
        { value: 'sri-murugan', label: 'Sri Murugan Cars', count: 1 },
        { value: 'arcot-car-point', label: 'Arcot Car Point', count: 1 },
      ],
      brands: [
        { value: 'tata', label: 'Tata', count: 1 },
        { value: 'hyundai', label: 'Hyundai', count: 1 },
      ],
    },
  };
}

const SITEMAP: PublicSitemapResponse = { vehicles: [], dealers: [] };
const LOCATIONS: PublicLocations = {
  districts: [{ slug: 'ranipet', name: 'Ranipet', count: 1, state: 'Tamil Nadu' }],
  total: 1,
  cars: { total: 8, districts: { ranipet: 8 } },
};

let enabled = true;
let listing = vehicles([card('a'), card('b')]);
const vehicleQueries: URLSearchParams[] = [];

function serve(): void {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) => {
    if (path === '/v1/config/public') {
      return Promise.resolve({ ...NO_PUBLIC_CONFIG, landingPagesEnabled: enabled });
    }
    if (path === '/v1/landing-pages') return Promise.resolve(LANDING_MAP);
    if (path === '/v1/sitemap') return Promise.resolve(SITEMAP);
    if (path === '/v1/locations') return Promise.resolve(LOCATIONS);
    if (path.startsWith('/v1/vehicles')) {
      vehicleQueries.push(new URLSearchParams(path.split('?')[1] ?? ''));
      return Promise.resolve(listing);
    }
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function args(segments: string[], query: Record<string, string> = {}) {
  return {
    params: Promise.resolve({ segments }),
    searchParams: Promise.resolve(query),
  };
}

function graphOf(container: HTMLElement): Record<string, unknown>[] {
  const script = container.querySelector('script[type="application/ld+json"]');
  const parsed = JSON.parse(script?.textContent ?? '{}') as {
    '@graph'?: Record<string, unknown>[];
  };
  return parsed['@graph'] ?? [];
}

beforeEach(() => {
  production();
  enabled = true;
  listing = vehicles([card('a'), card('b')]);
  vehicleQueries.length = 0;
  serve();
});

afterEach(() => {
  vi.unstubAllEnvs();
  apiGetParsed.mockReset();
});

describe('the switch', () => {
  it('is a 404 for every landing page while the switch is off', async () => {
    enabled = false;
    await expect(generateMetadata(args(['arcot', 'diesel']))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(UsedCarsLandingPage(args(['arcot']))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(apiGetParsed).not.toHaveBeenCalledWith(
      expect.anything(),
      '/v1/landing-pages',
      expect.anything(),
    );
  });
});

describe('what each address answers', () => {
  it('sends a district’s own page to the district page that already exists, with a 308', async () => {
    await expect(UsedCarsLandingPage(args(['ranipet']))).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:/cars?district=ranipet',
    );
    await expect(UsedCarsLandingPage(args(['vellore']))).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:/cars?district=vellore',
    );
  });

  it('is a 404 for a place or a facet outside the vocabulary', async () => {
    await expect(UsedCarsLandingPage(args(['nowhere']))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(UsedCarsLandingPage(args(['arcot', 'cheap']))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('asks the marketplace search for the same place and filter a buyer would', async () => {
    render(await UsedCarsLandingPage(args(['arcot', 'diesel'])));
    expect(Object.fromEntries(vehicleQueries[0] ?? [])).toEqual({
      district: 'ranipet',
      city: 'arcot',
      fuel: 'diesel',
    });
  });
});

describe('metadata', () => {
  it('titles, describes and canonicalises a page with two cars, and indexes it', async () => {
    const meta = await generateMetadata(args(['arcot', 'diesel']));

    expect(meta.title).toBe('2 Used Diesel Cars in Arcot');
    expect(meta.description).toMatch(/^2 used cars for sale in Arcot — Diesel/);
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/used-cars/arcot/diesel');
    expect(meta.robots).toMatchObject({ index: true, follow: true });
    expect(meta.openGraph?.images).toEqual([
      { url: 'https://media.test/a/1024.webp', alt: '2022 Tata Nexon a' },
    ]);
  });

  it('keeps a page with one car out of the index, but still follows its links', async () => {
    listing = vehicles([card('a')]);
    const meta = await generateMetadata(args(['arcot', 'hyundai-creta']));

    expect(meta.title).toBe('1 Used Hyundai Creta Car in Arcot');
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('counts only available cars, so two cars with one reserved is one', async () => {
    listing = vehicles([card('a'), card('b', 'RESERVED')]);
    const meta = await generateMetadata(args(['arcot']));
    expect(meta.title).toBe('1 Used Car in Arcot');
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('indexes a later page at its own address', async () => {
    listing = vehicles([card('a'), card('b')], 2, 3);
    const meta = await generateMetadata(args(['arcot'], { page: '2' }));

    expect(meta.title).toBe('2 Used Cars in Arcot – Page 2');
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/used-cars/arcot?page=2');
    expect(vehicleQueries[0]?.get('page')).toBe('2');
  });

  it('is a 404 past the last page, rather than an empty page that says the cars were sold', async () => {
    listing = vehicles([card('a'), card('b')], 4, 3);
    await expect(generateMetadata(args(['arcot'], { page: '4' }))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('never lets a non-production deployment be indexed', async () => {
    vi.stubEnv('APP_ENV', 'dev');
    const meta = await generateMetadata(args(['arcot', 'diesel']));
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe('the page', () => {
  it('headlines the count and the search, and breadcrumbs it through its district and town', async () => {
    const { container } = render(await UsedCarsLandingPage(args(['arcot', 'diesel'])));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '2 Used Diesel Cars in Arcot',
    );
    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(trail.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/cars',
      '/cars?district=ranipet',
      '/used-cars/arcot',
    ]);

    const crumbs = graphOf(container).find((node) => node['@type'] === 'BreadcrumbList');
    expect(crumbs?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.dealers-drive.com/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Cars',
        item: 'https://www.dealers-drive.com/cars',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Ranipet',
        item: 'https://www.dealers-drive.com/cars?district=ranipet',
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Arcot',
        item: 'https://www.dealers-drive.com/used-cars/arcot',
      },
      {
        '@type': 'ListItem',
        position: 5,
        name: 'Used Diesel Cars in Arcot',
        item: 'https://www.dealers-drive.com/used-cars/arcot/diesel',
      },
    ]);
  });

  it('lists the cars a buyer can open, only while the page is indexable', async () => {
    const indexed = render(await UsedCarsLandingPage(args(['arcot', 'diesel'])));
    expect(graphOf(indexed.container).find((node) => node['@type'] === 'ItemList')).toMatchObject({
      name: 'Used Diesel Cars in Arcot',
      numberOfItems: 2,
    });
    indexed.unmount();

    listing = vehicles([card('a')]);
    const single = render(await UsedCarsLandingPage(args(['arcot', 'hyundai-creta'])));
    expect(graphOf(single.container).map((node) => node['@type'])).toEqual(['BreadcrumbList']);
  });

  it('says who lists the cars and what is most listed, from the search’s own counts', async () => {
    render(await UsedCarsLandingPage(args(['arcot'])));
    expect(screen.getByText('Listed by Sri Murugan Cars and Arcot Car Point.')).toBeInTheDocument();
    expect(screen.getByText('Most listed: Tata (1), Hyundai (1).')).toBeInTheDocument();
  });

  it('offers the full search, filtered the same way, to refine it', async () => {
    render(await UsedCarsLandingPage(args(['arcot', 'diesel'])));
    expect(screen.getByRole('link', { name: 'Filter and sort these cars' })).toHaveAttribute(
      'href',
      '/cars?district=ranipet&city=arcot&fuel=diesel',
    );
  });

  it('links the related searches with crawlable links', async () => {
    render(await UsedCarsLandingPage(args(['arcot', 'diesel'])));
    const related = within(screen.getByRole('region', { name: 'More used cars around Arcot' }));
    expect(related.getByRole('link', { name: 'Used Maruti Suzuki Cars in Arcot' })).toHaveAttribute(
      'href',
      '/used-cars/arcot/maruti-suzuki',
    );
    expect(related.getByRole('link', { name: 'Used Diesel Cars in Ranipet' })).toHaveAttribute(
      'href',
      '/used-cars/ranipet/diesel',
    );
  });

  it('answers a search with no cars left with a way on, and keeps it out of the index', async () => {
    listing = vehicles([]);
    const meta = await generateMetadata(args(['arcot', 'petrol']));
    render(await UsedCarsLandingPage(args(['arcot', 'petrol'])));

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Used Petrol Cars in Arcot');
    expect(screen.getByRole('link', { name: 'See all used cars in Ranipet' })).toHaveAttribute(
      'href',
      '/cars?district=ranipet',
    );
  });
});

describe('/sitemap.xml', () => {
  it('lists every landing page with two cars or more, dated by its cars, while the switch is on', async () => {
    const urls = (await sitemap()).map((row) => row.url);
    const landing = (await sitemap()).filter((row) => row.url.includes('/used-cars/'));

    expect(urls).toEqual(
      expect.arrayContaining([
        'https://www.dealers-drive.com/used-cars/arcot',
        'https://www.dealers-drive.com/used-cars/arcot/diesel',
        'https://www.dealers-drive.com/used-cars/arcot/maruti-suzuki-swift',
        'https://www.dealers-drive.com/used-cars/ranipet/diesel',
        'https://www.dealers-drive.com/used-cars/vellore/maruti-suzuki',
      ]),
    );
    expect(urls).not.toContain('https://www.dealers-drive.com/used-cars/arcot/hyundai-creta');
    expect(urls).not.toContain('https://www.dealers-drive.com/used-cars/ranipet');
    expect(urls).not.toContain('https://www.dealers-drive.com/used-cars/vellore');
    expect(landing.every((row) => row.lastModified === LANDING_AT)).toBe(true);
  });

  it('still answers with every other page when the landing read fails', async () => {
    const answer = apiGetParsed.getMockImplementation();
    apiGetParsed.mockImplementation((schema: unknown, path: string) =>
      path === '/v1/landing-pages'
        ? Promise.reject(new Error('down'))
        : (answer?.(schema, path) as unknown),
    );
    const urls = (await sitemap()).map((row) => row.url);
    expect(urls).toContain('https://www.dealers-drive.com/cars?district=ranipet');
    expect(urls.some((url) => url.includes('/used-cars/'))).toBe(false);
  });

  it('lists none, and does not ask for them, while the switch is off', async () => {
    enabled = false;
    const urls = (await sitemap()).map((row) => row.url);
    expect(urls.some((url) => url.includes('/used-cars/'))).toBe(false);
    expect(apiGetParsed).not.toHaveBeenCalledWith(
      expect.anything(),
      '/v1/landing-pages',
      expect.anything(),
    );
  });
});

describe('/cars in a district', () => {
  it('links the district’s landing pages while the switch is on', async () => {
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet' }) }));
    const related = within(screen.getByRole('region', { name: 'More used cars around Ranipet' }));
    expect(related.getByRole('link', { name: 'Used Diesel Cars in Ranipet' })).toHaveAttribute(
      'href',
      '/used-cars/ranipet/diesel',
    );
    expect(related.getByRole('link', { name: 'Used Cars in Arcot' })).toHaveAttribute(
      'href',
      '/used-cars/arcot',
    );
  });

  it('links nothing on a filtered view, or while the switch is off', async () => {
    const filtered = render(
      await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet', fuel: 'diesel' }) }),
    );
    expect(screen.queryByRole('region', { name: /More used cars around/ })).toBeNull();
    filtered.unmount();

    enabled = false;
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet' }) }));
    expect(screen.queryByRole('region', { name: /More used cars around/ })).toBeNull();
  });
});
