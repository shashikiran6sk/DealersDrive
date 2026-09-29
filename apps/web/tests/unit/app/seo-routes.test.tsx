import {
  NO_VEHICLE_FACETS,
  type DealerDirectoryResponse,
  type PublicLocations,
  type PublicSitemapResponse,
  type PublicVehiclesResponse,
  type VehicleCardDto,
} from '@dealers-drive/contracts';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CarsPage, { generateMetadata as carsMetadata } from '@/app/(public)/cars/page';
import { generateMetadata as contactMetadata } from '@/app/(public)/contact/page';
import DealerDirectoryPage, {
  generateMetadata as dealersMetadata,
} from '@/app/(public)/dealers/page';
import HomePage, { generateMetadata as homeMetadata } from '@/app/(public)/page';
import { generateMetadata as loginMetadata } from '@/app/(auth)/login/page';
import { metadata as adminLoginMetadata } from '@/app/(auth)/admin/login/page';
import { generateMetadata as rootMetadata } from '@/app/layout';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import type * as ApiModule from '@/lib/api';
import { NO_PUBLIC_CONFIG } from '@/lib/public-config';

import { production } from '../lib/seo/env';

/**
 * Every public route's metadata, and the two files search engines ask for
 * first. The policy under each is tested in `tests/unit/lib/seo`; these hold
 * the wiring — that each page actually asks for it, with its own title.
 */
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('next/font/google', () => ({ Manrope: () => ({ variable: 'font-manrope' }) }));

const apiGet = vi.fn();
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: (...args: unknown[]) => apiGet(...args) as unknown,
  apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown,
}));

const LOCATIONS: PublicLocations = {
  districts: [{ slug: 'vellore', name: 'Vellore', count: 2, state: 'Tamil Nadu' }],
  total: 2,
  cars: { total: 2, districts: { vellore: 2 } },
};

function card(slug: string, availability: VehicleCardDto['availability'] = 'AVAILABLE') {
  return {
    slug,
    availability,
    title: `2022 Maruti Suzuki Brezza ${slug}`,
    year: 2022,
    priceLabel: '₹6,45,000',
    metaLabel: '42,180 km · Petrol · Manual · Vellore',
    image: null,
    imageCount: 0,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
  } satisfies VehicleCardDto;
}

function vehicles(data: VehicleCardDto[], page = 1): PublicVehiclesResponse {
  return {
    data,
    page: { page, limit: 24, total: data.length, totalPages: 3 },
    available: data.length,
    facets: NO_VEHICLE_FACETS,
  };
}

const DIRECTORY: DealerDirectoryResponse = {
  data: [
    {
      slug: 'adoni-motor-traders-llp-adoni-kurnool-andhra-pradesh',
      brandName: 'Adoni Motor Traders LLP',
      initials: 'AM',
      city: 'Adoni',
      state: 'Andhra Pradesh',
      yearsOperating: 12,
      yearsLabel: '12 years',
      tagline: null,
      services: [],
      carCount: 3,
      fromPricePaise: null,
      fromPriceLabel: '',
      isVerified: true,
      logoUrl: null,
      coverUrl: null,
    },
  ],
  page: { page: 1, limit: 24, total: 1, totalPages: 1 },
  countLabel: '1 dealership',
  cities: [],
  districts: [{ slug: 'kurnool', name: 'Kurnool', count: 1, state: 'Andhra Pradesh' }],
};

function serveCars(listing: PublicVehiclesResponse): void {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
    Promise.resolve(
      path === '/v1/locations'
        ? LOCATIONS
        : path === '/v1/config/public'
          ? NO_PUBLIC_CONFIG
          : listing,
    ),
  );
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  apiGet.mockReset();
  apiGetParsed.mockReset();
});

describe('the root layout', () => {
  it('sets one origin, the site name, a title template and social defaults', () => {
    const meta = rootMetadata();

    expect(meta.metadataBase?.toString()).toBe('https://www.dealers-drive.com/');
    expect(meta.applicationName).toBe('Dealers-Drive');
    expect(meta.title).toEqual({
      default: 'Dealers-Drive | Used Cars from Verified Independent Dealers',
      template: '%s | Dealers-Drive',
    });
    expect(meta.openGraph).toMatchObject({ siteName: 'Dealers-Drive', locale: 'en_IN' });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  /**
   * `app/favicon.ico`, `app/icon.png` and `app/apple-icon.png` are the icons;
   * Next writes their `<link>` tags. Declaring `icons` here as well is how a
   * page ends up with two favicons that disagree.
   */
  /**
   * Every public page states its own robots. A default here would be inherited
   * by the not-found page too, which then carried Next's `noindex` beside an
   * `index, follow` — so production has none, and only a non-production
   * deployment sets one, as a net under any page that forgot.
   */
  it('sets no robots default in production, and noindex everywhere else', () => {
    expect(rootMetadata()).not.toHaveProperty('robots');

    vi.stubEnv('APP_ENV', 'preview');
    expect(rootMetadata().robots).toEqual({ index: false, follow: false });
  });

  it('declares no icons of its own — the app-directory files are the only source', () => {
    expect(rootMetadata()).not.toHaveProperty('icons');
  });
});

describe('/', () => {
  it('has its own title, description and canonical', () => {
    const meta = homeMetadata();

    expect(meta.title).toEqual({
      absolute: 'Dealers-Drive | Used Cars from Verified Independent Dealers',
    });
    expect(meta.description).toMatch(/verified independent dealers/);
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/');
    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });

  it('publishes the Organization and the WebSite', async () => {
    serveCars(vehicles([card('a')]));
    const { container } = render(await HomePage());
    const types = graphOf(container).map((node) => node['@type']);

    expect(types).toEqual(['Organization', 'WebSite']);
  });
});

describe('/cars', () => {
  it('indexes the directory at /cars', async () => {
    serveCars(vehicles([card('a')]));
    const meta = await carsMetadata({ searchParams: Promise.resolve({}) });

    expect(meta.title).toBe('Used Cars for Sale');
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/cars');
    expect(meta.robots).toMatchObject({ index: true });
  });

  it('indexes a district as a landing page of its own', async () => {
    serveCars(vehicles([card('a')]));
    const meta = await carsMetadata({ searchParams: Promise.resolve({ district: 'vellore' }) });

    expect(meta.title).toBe('Used Cars in Vellore');
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/cars?district=vellore');
    expect(meta.robots).toMatchObject({ index: true });
  });

  it('keeps a filtered, sorted or searched view out of the index', async () => {
    serveCars(vehicles([card('a')]));
    for (const query of [{ fuel: 'diesel' }, { sort: 'price_asc' }, { q: 'brezza' }]) {
      const meta = await carsMetadata({ searchParams: Promise.resolve(query) });
      expect(meta.robots).toEqual({ index: false, follow: true });
      expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/cars');
    }
  });

  it('indexes a later page at its own URL, and keeps an empty one out', async () => {
    serveCars(vehicles([card('a')], 2));
    const second = await carsMetadata({ searchParams: Promise.resolve({ page: '2' }) });
    expect(second.alternates?.canonical).toBe('https://www.dealers-drive.com/cars?page=2');
    expect(second.title).toBe('Used Cars for Sale – Page 2');

    serveCars(vehicles([], 9));
    const empty = await carsMetadata({ searchParams: Promise.resolve({ page: '9' }) });
    expect(empty.robots).toEqual({ index: false, follow: true });
  });

  it('lists the cars a buyer can open, in page order, and breadcrumbs the page', async () => {
    serveCars(vehicles([card('a'), card('b'), card('c', 'RESERVED')]));
    const { container } = render(await CarsPage({ searchParams: Promise.resolve({}) }));
    const graph = graphOf(container);
    const list = graph.find((node) => node['@type'] === 'ItemList');

    expect(graph.map((node) => node['@type'])).toEqual(['BreadcrumbList', 'ItemList']);
    expect(list?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: '2022 Maruti Suzuki Brezza a',
        url: 'https://www.dealers-drive.com/car/a',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '2022 Maruti Suzuki Brezza b',
        url: 'https://www.dealers-drive.com/car/b',
      },
    ]);
  });

  it('publishes no list for a view that is not indexed', async () => {
    serveCars(vehicles([card('a')]));
    const { container } = render(
      await CarsPage({ searchParams: Promise.resolve({ fuel: 'diesel' }) }),
    );
    expect(graphOf(container).map((node) => node['@type'])).toEqual(['BreadcrumbList']);
  });
});

describe('/dealers', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue(DIRECTORY);
    apiGetParsed.mockResolvedValue(LOCATIONS);
  });

  it('indexes the directory, titled for what it is', async () => {
    const meta = await dealersMetadata({ searchParams: Promise.resolve({}) });

    expect(meta.title).toBe('Used Car Dealers');
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/dealers');
    expect(meta.robots).toMatchObject({ index: true });
  });

  it('titles and canonicalises a district page by its district', async () => {
    const meta = await dealersMetadata({ searchParams: Promise.resolve({ district: 'kurnool' }) });

    expect(meta.title).toBe('Used Car Dealers in Kurnool');
    expect(meta.alternates?.canonical).toBe(
      'https://www.dealers-drive.com/dealers?district=kurnool',
    );
  });

  it('keeps a name search out of the index', async () => {
    const meta = await dealersMetadata({ searchParams: Promise.resolve({ q: 'adoni' }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('lists each dealership at its profile URL', async () => {
    const { container } = render(await DealerDirectoryPage({ searchParams: Promise.resolve({}) }));
    const list = graphOf(container).find((node) => node['@type'] === 'ItemList');

    expect(list?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Adoni Motor Traders LLP',
        url: 'https://www.dealers-drive.com/dealers/adoni-motor-traders-llp-adoni-kurnool-andhra-pradesh',
      },
    ]);
  });
});

describe('/contact', () => {
  it('is indexable at its own canonical', () => {
    const meta = contactMetadata();

    expect(meta.title).toBe('Contact & support');
    expect(meta.alternates?.canonical).toBe('https://www.dealers-drive.com/contact');
    expect(meta.robots).toMatchObject({ index: true });
    expect(meta.openGraph).toMatchObject({ url: 'https://www.dealers-drive.com/contact' });
  });
});

describe('the sign-in pages', () => {
  it('keeps /login out of the index but lets its links be followed', () => {
    expect(loginMetadata().robots).toEqual({ index: false, follow: true });
    expect(loginMetadata().alternates).toBeUndefined();
  });

  it('keeps the admin sign-in out entirely', () => {
    expect(adminLoginMetadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('/robots.txt', () => {
  it('is the production policy, with the sitemap', async () => {
    expect(await robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/v1/'] },
      sitemap: 'https://www.dealers-drive.com/sitemap.xml',
    });
  });
});

describe('/sitemap.xml', () => {
  const PAGES: PublicSitemapResponse = {
    vehicles: [{ slug: 'a-car', lastModified: '2026-09-20T10:00:00.000Z' }],
    dealers: [{ slug: 'sri', lastModified: null }],
  };

  it('is built from the sitemap read and the districts, cached and tagged', async () => {
    apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
      Promise.resolve(path === '/v1/locations' ? LOCATIONS : PAGES),
    );
    const rows = await sitemap();

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/sitemap', {
      revalidate: 3600,
      tags: ['vehicles', 'dealers'],
    });
    expect(rows.map((row) => row.url)).toContain('https://www.dealers-drive.com/car/a-car');
    expect(rows.map((row) => row.url)).toContain('https://www.dealers-drive.com/dealers/sri');
  });

  /**
   * A sitemap that silently drops every car while the API is down would tell
   * a crawler the marketplace is four pages. The failure goes through as a 5xx,
   * and the last good sitemap is what the crawler keeps.
   */
  it('fails loudly when the API does, rather than answering with a sitemap missing every car', async () => {
    apiGetParsed.mockRejectedValue(new Error('down'));
    await expect(sitemap()).rejects.toThrow('down');
  });
});
