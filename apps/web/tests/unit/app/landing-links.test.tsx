import {
  NO_VEHICLE_FACETS,
  type PublicLocations,
  type PublicVehicleDetail,
  type PublicVehiclesResponse,
} from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VehiclePage from '@/app/(public)/car/[slug]/page';
import CarsPage from '@/app/(public)/cars/page';
import HomePage from '@/app/(public)/page';
import type * as ApiModule from '@/lib/api';
import { NO_PUBLIC_CONFIG } from '@/lib/public-config';

import { LANDING_MAP } from '../lib/landing-fixtures';
import { production } from '../lib/seo/env';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown,
}));

const SLUG = '2022-hyundai-creta-sx-arcot-1a2b3c4d';

const CAR: PublicVehicleDetail = {
  slug: SLUG,
  availability: 'AVAILABLE',
  title: '2022 Hyundai Creta SX',
  year: 2022,
  priceLabel: '₹12,00,000',
  negotiabilityLabel: null,
  summary: 'Diesel · Manual · 30,000 km',
  description: null,
  specs: [],
  images: [],
  primaryIndex: 0,
  publishedLabel: null,
  facts: {
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    bodyType: 'SUV',
    fuelType: 'Diesel',
    transmission: 'Manual',
    color: 'White',
    kilometersDriven: 30_000,
    ownerCount: 1,
    pricePaise: 120_000_000,
  },
  dealer: {
    name: 'Sri Murugan Cars',
    slug: 'sri-murugan',
    initials: 'SM',
    isVerified: true,
    location: 'Arcot, Ranipet',
    city: 'Arcot',
    district: 'Ranipet',
    state: 'Tamil Nadu',
  },
};

const NONE: PublicVehiclesResponse = {
  data: [],
  page: { page: 1, limit: 24, total: 0, totalPages: 1 },
  available: 0,
  facets: NO_VEHICLE_FACETS,
};

const LOCATIONS: PublicLocations = {
  districts: [{ slug: 'ranipet', name: 'Ranipet', count: 1, state: 'Tamil Nadu' }],
  total: 1,
  cars: { total: 8, districts: { ranipet: 8 } },
};

let enabled = true;

beforeEach(() => {
  production();
  enabled = true;
  apiGetParsed.mockImplementation((_schema: unknown, path: string) => {
    if (path === '/v1/config/public') {
      return Promise.resolve({ ...NO_PUBLIC_CONFIG, landingPagesEnabled: enabled });
    }
    if (path === '/v1/landing-pages') return Promise.resolve(LANDING_MAP);
    if (path === '/v1/locations') return Promise.resolve(LOCATIONS);
    if (path === `/v1/vehicles/${SLUG}`) return Promise.resolve(CAR);
    if (path.endsWith('/similar')) return Promise.resolve({ data: [] });
    if (path.startsWith('/v1/vehicles')) return Promise.resolve(NONE);
    return Promise.reject(new Error(`unexpected ${path}`));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  apiGetParsed.mockReset();
});

function hrefsIn(name: string): (string | null)[] {
  return within(screen.getByRole('region', { name }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
}

describe('a car page', () => {
  it('links the searches the car belongs to, in its town and across its district', async () => {
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    expect(hrefsIn('Find more cars like this')).toEqual([
      '/used-cars/arcot/diesel',
      '/used-cars/ranipet/diesel',
    ]);
  });

  it('links nothing while the switch is off', async () => {
    enabled = false;
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    expect(screen.queryByRole('region', { name: 'Find more cars like this' })).toBeNull();
  });

  it('still renders when the landing pages cannot be read', async () => {
    const answer = apiGetParsed.getMockImplementation();
    apiGetParsed.mockImplementation((schema: unknown, path: string) =>
      path === '/v1/landing-pages'
        ? Promise.reject(new Error('down'))
        : (answer?.(schema, path) as unknown),
    );
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Find more cars like this' })).toBeNull();
  });
});

describe('the home page', () => {
  it('carries no browse block of its own — the footer row is its link to the landing pages', async () => {
    render(await HomePage());
    expect(screen.queryByRole('region', { name: 'Browse by place, brand and budget' })).toBeNull();
  });
});

describe('/cars with no district', () => {
  it('offers the browse links collapsed behind See more, and not on a filtered view', async () => {
    const all = render(await CarsPage({ searchParams: Promise.resolve({}) }));
    expect(hrefsIn('Browse by place, brand and budget')).toContain(
      '/used-cars/arcot/maruti-suzuki',
    );
    expect(screen.getByRole('button', { name: 'See more' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    all.unmount();

    render(await CarsPage({ searchParams: Promise.resolve({ fuel: 'diesel' }) }));
    expect(screen.queryByRole('region', { name: 'Browse by place, brand and budget' })).toBeNull();
  });
});
