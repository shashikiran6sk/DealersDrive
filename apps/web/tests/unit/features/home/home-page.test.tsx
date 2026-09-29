import type {
  CarSuggestion,
  CarSuggestResponse,
  FacetOption,
  PublicVehiclesResponse,
  VehicleCardDto,
} from '@dealers-drive/contracts';
import { NO_VEHICLE_FACETS } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/(public)/page';
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

const BRANDS: FacetOption[] = [
  { value: 'hyundai', label: 'Hyundai', count: 9 },
  { value: 'tata', label: 'Tata', count: 4 },
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
  apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
    Promise.resolve(byPath(path)),
  );
}

afterEach(() => {
  apiGetParsed.mockReset();
  vi.unstubAllGlobals();
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
    expect(suvs.getByRole('link', { name: 'View all →' })).toHaveAttribute(
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

  it('never says how many cars the marketplace holds', async () => {
    serve((path) =>
      path.includes('bodyType=suv') ? response([card('suv-1')], 17) : response([card(path)], 40),
    );
    render(await HomePage());

    const links = screen.getAllByRole('link', { name: /View all/ });
    expect(links).toHaveLength(4);
    for (const link of links) expect(link).toHaveTextContent(/^View all →$/);
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
    apiGetParsed.mockRejectedValue(new Error('down'));
    render(await HomePage());

    expect(screen.getByRole('search')).toBeInTheDocument();
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

const CRETA: CarSuggestion = {
  kind: 'MODEL',
  label: 'Hyundai Creta',
  metaLabel: 'Model · 5 cars',
  brand: 'hyundai',
  model: 'creta',
  variant: null,
  count: 5,
};

function suggesting(data: CarSuggestion[] = [CRETA]): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      calls.push(url);
      const search = new URL(url, 'http://localhost').searchParams.get('search') ?? '';
      const body: CarSuggestResponse = {
        search,
        data,
        countLabel: `${String(data.length)} matches`,
      };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    }),
  );
  return calls;
}

async function homeSearch() {
  serve(() => response([card('a')]));
  render(await HomePage());
  return screen.getByRole('combobox', { name: 'Search cars by make, model or variant' });
}

describe('the homepage search — the /cars search box, pointed at /cars', () => {
  it('is one text box with no button to press', async () => {
    await homeSearch();
    const form = screen.getByRole('search');
    expect(within(form).getAllByRole('combobox')).toHaveLength(1);
    expect(within(form).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Brand')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Budget')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'District' })).not.toBeInTheDocument();
  });

  it('suggests makes and models from the whole marketplace as the buyer types', async () => {
    const calls = suggesting();
    const user = userEvent.setup();
    await user.type(await homeSearch(), 'creta');
    expect(await screen.findByRole('option', { name: /Hyundai Creta/ })).toBeInTheDocument();
    expect(calls).toEqual(['/api/search/vehicles?search=creta']);
  });

  it('opens /cars with the chosen suggestion as filters', async () => {
    suggesting();
    const user = userEvent.setup();
    await user.type(await homeSearch(), 'creta');
    await user.click(await screen.findByRole('option', { name: /Hyundai Creta/ }));
    expect(navigationState.pushed).toEqual(['/cars?brand=hyundai&model=creta']);
  });

  it('opens /cars?q= with the words when Enter is pressed on free text', async () => {
    suggesting([]);
    const user = userEvent.setup();
    const input = await homeSearch();
    await user.type(input, 'creta sx');
    await waitFor(() => expect(screen.getByText(/No matching cars/)).toBeInTheDocument());
    await user.keyboard('{Enter}');
    expect(navigationState.pushed).toEqual(['/cars?q=creta+sx']);
  });

  it('is a GET form on /cars with the words as q, so it works before the script loads', async () => {
    const input = await homeSearch();
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', '/cars');
    expect(form).toHaveAttribute('method', 'get');
    expect(input).toHaveAttribute('name', 'q');
  });

  it('no longer loads districts or model facets for the hero', async () => {
    await homeSearch();
    const paths = apiGetParsed.mock.calls.map((call) => String(call[1]));
    expect(paths.some((path) => path.startsWith('/v1/locations'))).toBe(false);
    // The one other read is the public config, for the admin-set hero photograph (R81).
    const others = paths.filter((path) => !path.endsWith('limit=4'));
    expect(others).toEqual(['/v1/config/public']);
  });
});
