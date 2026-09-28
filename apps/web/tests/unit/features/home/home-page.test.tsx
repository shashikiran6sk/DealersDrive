import type {
  FacetOption,
  PublicLocations,
  PublicVehiclesResponse,
  VehicleCardDto,
} from '@dealers-drive/contracts';
import { NO_VEHICLE_FACETS } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/(public)/page';
import { heroFacetsAction } from '@/features/home/actions';
import { HeroSearch, heroHref, type HeroFacetsLoader } from '@/features/home/hero-search';
import type * as ApiModule from '@/lib/api';

import { navigationState } from '../../../setup.js';

/**
 * R72 — the homepage is an entry into `/cars`, not a second search. The hero
 * builds a `/cars` URL with the same parameters the results page reads, the
 * model list comes from the marketplace's own facets once a brand is chosen,
 * and the four rows are `/v1/vehicles` with ordinary filters, showing only cars
 * a buyer can act on.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'ranipet', name: 'Ranipet', count: 4, state: 'Tamil Nadu' },
    { slug: 'vellore', name: 'Vellore', count: 6, state: 'Tamil Nadu' },
  ],
  total: 10,
  cars: { total: 30, districts: { ranipet: 12, vellore: 18 } },
};

const BRANDS: FacetOption[] = [
  { value: 'hyundai', label: 'Hyundai', count: 9 },
  { value: 'tata', label: 'Tata', count: 4 },
];

const MODELS: FacetOption[] = [
  { value: 'creta', label: 'Creta', count: 5, parent: 'hyundai' },
  { value: 'venue', label: 'Venue', count: 4, parent: 'hyundai' },
];

function card(slug: string, overrides: Partial<VehicleCardDto> = {}): VehicleCardDto {
  return {
    slug,
    availability: 'AVAILABLE',
    title: `2022 Hyundai Creta ${slug}`,
    year: 2022,
    priceLabel: '₹12,00,000',
    metaLabel: '30,000 km · Petrol · Manual · Vellore',
    image: null,
    imageCount: 0,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
    ...overrides,
  };
}

function response(data: VehicleCardDto[], available = data.length): PublicVehiclesResponse {
  return {
    data,
    page: { page: 1, limit: 4, total: data.length, totalPages: 1 },
    available,
    facets: { ...NO_VEHICLE_FACETS, brands: BRANDS },
  };
}

function serve(byPath: (path: string) => PublicVehiclesResponse) {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) => {
    if (path.startsWith('/v1/locations')) return Promise.resolve(LOCATIONS);
    return Promise.resolve(byPath(path));
  });
}

afterEach(() => {
  apiGetParsed.mockReset();
});

describe('the homepage', () => {
  it('asks the marketplace for four rows through ordinary filters, four cars each', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());

    const paths = apiGetParsed.mock.calls
      .map((call) => String(call[1]))
      .filter((path) => path.startsWith('/v1/vehicles'));
    expect(paths.sort()).toEqual(
      [
        '/v1/vehicles?limit=4',
        '/v1/vehicles?bodyType=suv&limit=4',
        '/v1/vehicles?transmission=automatic&limit=4',
        '/v1/vehicles?maxPrice=100000000&limit=4',
      ].sort(),
    );
  });

  it('shows each row with its cards and a link to the same search on /cars', async () => {
    serve((path) =>
      path.includes('bodyType=suv')
        ? response([card('suv-1'), card('suv-2')], 17)
        : response([card(path)], 40),
    );
    render(await HomePage());

    expect(screen.getByRole('heading', { level: 1, name: 'Find your next car' })).toBeVisible();
    const suvs = within(screen.getByRole('region', { name: 'SUVs' }));
    expect(suvs.getAllByRole('article')).toHaveLength(2);
    expect(suvs.getByRole('link', { name: 'View all 17 →' })).toHaveAttribute(
      'href',
      '/cars?bodyType=suv',
    );
    for (const [name, href] of [
      ['Recently added', '/cars'],
      ['Automatic cars', '/cars?transmission=automatic'],
      ['Under ₹10 lakh', '/cars?maxPrice=100000000'],
    ] as const) {
      const row = within(screen.getByRole('region', { name }));
      expect(row.getByRole('link', { name: /View all/ })).toHaveAttribute('href', href);
    }
  });

  it('promotes only cars a buyer can act on — never a reserved one', async () => {
    serve(() =>
      response([card('open'), card('held', { availability: 'RESERVED', title: 'Held car' })], 1),
    );
    render(await HomePage());

    expect(screen.queryByText('Held car')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
  });

  it('leaves out a row with nothing in it', async () => {
    serve((path) => (path.includes('transmission') ? response([]) : response([card(path)])));
    render(await HomePage());
    expect(screen.queryByRole('region', { name: 'Automatic cars' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'SUVs' })).toBeInTheDocument();
  });

  it('still offers the search when the marketplace cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
      path.startsWith('/v1/locations')
        ? Promise.resolve(LOCATIONS)
        : Promise.reject(new Error('down')),
    );
    render(await HomePage());

    expect(screen.getByRole('search', { name: 'Find a car' })).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Cars on Dealers-Drive now' }),
    ).not.toBeInTheDocument();
  });

  it('no longer claims search or enquiries are coming soon', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());
    expect(screen.queryByText(/(search|enquir|saved).*coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/next features/i)).not.toBeInTheDocument();
  });
});

function hero(
  loadFacets: HeroFacetsLoader = vi.fn(() => Promise.resolve({ brands: BRANDS, models: MODELS })),
) {
  render(<HeroSearch locations={LOCATIONS} brands={BRANDS} loadFacets={loadFacets} />);
  return loadFacets;
}

describe('HeroSearch', () => {
  it('searches every car when nothing is chosen', () => {
    hero();
    fireEvent.click(screen.getByRole('button', { name: 'Search cars' }));
    expect(navigationState.pushed).toEqual(['/cars']);
  });

  it('offers the marketplace’s brands with their counts, and no model until a brand is chosen', () => {
    hero();
    const brand = screen.getByLabelText('Brand');
    expect(
      within(brand)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Any brand', 'Hyundai (9)', 'Tata (4)']);
    expect(screen.getByLabelText('Model')).toBeDisabled();
    expect(screen.getByLabelText('Model')).toHaveDisplayValue('Choose a brand first');
  });

  it('loads the chosen brand’s models from the facets, then searches district, brand, model and budget', async () => {
    const loadFacets = hero();

    const district = screen.getByRole('button', { name: 'District' });
    expect(district).toHaveTextContent('Select district');
    fireEvent.click(district);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Ranipet/ }));
    await waitFor(() => expect(loadFacets).toHaveBeenCalledWith('ranipet', undefined));

    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'hyundai' } });
    await waitFor(() => expect(loadFacets).toHaveBeenLastCalledWith('ranipet', 'hyundai'));
    await waitFor(() => expect(screen.getByLabelText('Model')).toBeEnabled());
    expect(
      within(screen.getByLabelText('Model'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Any model', 'Creta (5)', 'Venue (4)']);

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'creta' } });
    fireEvent.change(screen.getByLabelText('Budget'), { target: { value: '150000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search cars' }));

    expect(navigationState.pushed).toEqual([
      '/cars?district=ranipet&brand=hyundai&model=creta&maxPrice=150000000',
    ]);
  });

  it('forgets the model when the brand changes', async () => {
    hero();
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'hyundai' } });
    await waitFor(() => expect(screen.getByLabelText('Model')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'creta' } });
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'tata' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search cars' }));
    expect(navigationState.pushed.at(-1)).toBe('/cars?brand=tata');
  });

  it('offers budgets as ceilings in rupee lakh', () => {
    hero();
    const options = within(screen.getByLabelText('Budget'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options[0]).toBe('Any budget');
    expect(options).toContain('Up to ₹15 lakh');
  });

  it('is a GET form on /cars, so it works before the script loads', () => {
    hero();
    const form = screen.getByRole('search', { name: 'Find a car' });
    expect(form).toHaveAttribute('action', '/cars');
    expect(form).toHaveAttribute('method', 'get');
  });
});

describe('heroHref', () => {
  it('drops a model with no brand, and every empty field', () => {
    expect(heroHref({ district: '', brand: '', model: 'creta', maxPrice: '' })).toBe('/cars');
    expect(heroHref({ district: 'vellore', brand: '', model: '', maxPrice: '50000000' })).toBe(
      '/cars?district=vellore&maxPrice=50000000',
    );
  });
});

describe('heroFacetsAction', () => {
  it('reads the brands and a brand’s models from the marketplace search', async () => {
    apiGetParsed.mockResolvedValue({
      ...response([]),
      facets: { ...NO_VEHICLE_FACETS, brands: BRANDS, models: MODELS },
    });
    await expect(heroFacetsAction('ranipet', 'hyundai')).resolves.toEqual({
      brands: BRANDS,
      models: MODELS,
    });
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/vehicles?district=ranipet&brand=hyundai&limit=1',
      expect.anything(),
    );
  });

  it('sends nothing for a value the search would refuse', async () => {
    await expect(heroFacetsAction('Not A Slug!')).resolves.toEqual({ brands: [], models: [] });
    expect(apiGetParsed).not.toHaveBeenCalled();
  });

  it('answers with nothing rather than failing when the API is down', async () => {
    apiGetParsed.mockRejectedValue(new Error('down'));
    await expect(heroFacetsAction()).resolves.toEqual({ brands: [], models: [] });
  });
});
