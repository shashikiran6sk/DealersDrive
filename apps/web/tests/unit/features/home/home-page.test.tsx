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
import { AUDIENCE_TEXT } from '@/features/home/audience-section';
import { DECK_TEXT } from '@/features/home/category-deck';
import { SHORTCUTS_TEXT } from '@/features/home/category-shortcuts';
import { HOME_HERO_IMAGE } from '@/features/home/hero-banner';
import { HOME_CATEGORIES } from '@/features/home/home.constants';
import { JOURNEY_TEXT } from '@/features/home/journey-section';
import { MAKES_STRIP_TEXT } from '@/features/home/makes-strip';
import { STOCK_STREAM_TEXT } from '@/features/home/stock-stream';
import type * as ApiModule from '@/lib/api';
import { NO_PUBLIC_CONFIG } from '@/lib/public-config';

import { navigationState } from '../../../setup.js';

/**
 * The homepage is an entry into `/cars`, not a second search (R72). The hero is
 * the `/cars` search box and five shortcuts; a stream of recent cars sits beside
 * it; five shopping categories stack below, each an ordinary `/v1/vehicles`
 * request with a filter; then "Recently added" and the two explainers.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const BRANDS: FacetOption[] = [
  { value: 'hyundai', label: 'Hyundai', count: 9 },
  { value: 'tata', label: 'Tata', count: 4 },
  { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 3 },
];

function card(slug: string, overrides: Partial<VehicleCardDto> = {}): VehicleCardDto {
  return {
    slug,
    availability: 'AVAILABLE',
    title: `2022 Hyundai Creta ${slug}`,
    year: 2022,
    priceLabel: '₹12,00,000',
    negotiability: 'FIXED',
    metaLabel: '30,000 km · Petrol · Manual · Vellore',
    image: null,
    imageCount: 0,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
    ...overrides,
  };
}

function cards(prefix: string, count: number): VehicleCardDto[] {
  return Array.from({ length: count }, (_, index) => card(`${prefix}-${String(index)}`));
}

function response(
  data: VehicleCardDto[],
  available = data.length,
  brands = BRANDS,
): PublicVehiclesResponse {
  return {
    data,
    page: { page: 1, limit: 10, total: data.length, totalPages: 1 },
    available,
    facets: { ...NO_VEHICLE_FACETS, brands },
  };
}

function serve(byPath: (path: string) => PublicVehiclesResponse) {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
    Promise.resolve(path === '/v1/config/public' ? NO_PUBLIC_CONFIG : byPath(path)),
  );
}

function vehicleReads(): string[] {
  return apiGetParsed.mock.calls
    .map((call) => String(call[1]))
    .filter((path) => path.startsWith('/v1/vehicles'));
}

function category(name: string) {
  return within(screen.getByRole('article', { name }));
}

afterEach(() => {
  apiGetParsed.mockReset();
  vi.unstubAllGlobals();
});

describe('the homepage reads', () => {
  it('asks once for recent cars and once per category, through ordinary filters', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());

    expect(vehicleReads().sort()).toEqual(
      [
        '/v1/vehicles?limit=10',
        '/v1/vehicles?bodyType=suv&limit=3',
        '/v1/vehicles?transmission=automatic&limit=3',
        '/v1/vehicles?maxPrice=100000000&sort=price_asc&limit=3',
        '/v1/vehicles?bodyType=muv&limit=3',
        '/v1/vehicles?maxKm=100000&limit=3',
      ].sort(),
    );
  });

  it('defines family cars as MUVs', () => {
    expect(HOME_CATEGORIES.find((entry) => entry.key === 'family')?.params).toEqual({
      bodyType: 'muv',
    });
  });
});

describe('the hero', () => {
  it('keeps the headline and offers the five categories as shortcuts to /cars', async () => {
    serve(() => response(cards('r', 6)));
    render(await HomePage());

    expect(screen.getByRole('heading', { level: 1, name: 'Find your perfect car' })).toBeVisible();
    const shortcuts = within(screen.getByRole('navigation', { name: SHORTCUTS_TEXT.label }));
    expect(shortcuts.getAllByRole('link')).toHaveLength(5);
    for (const [name, href] of [
      ['SUVs', '/cars?bodyType=suv'],
      ['Automatic', '/cars?transmission=automatic'],
      ['Under ₹10L', '/cars?maxPrice=100000000&sort=price_asc'],
      ['Family cars', '/cars?bodyType=muv'],
      ['Low km', '/cars?maxKm=100000'],
    ] as const) {
      expect(shortcuts.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('streams recent cars beside the search as display-only cards', async () => {
    serve((path) => (path === '/v1/vehicles?limit=10' ? response(cards('r', 6)) : response([])));
    render(await HomePage());

    const stream = screen.getByRole('region', { name: STOCK_STREAM_TEXT.label });
    expect(within(stream).getAllByRole('article')).toHaveLength(6);
    expect(within(stream).queryByRole('link')).not.toBeInTheDocument();
    expect(within(stream).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: HOME_HERO_IMAGE.alt })).not.toBeInTheDocument();
  });

  it('shows the hero photograph in place of the stream when too few cars are listed', async () => {
    serve(() => response(cards('r', 3)));
    render(await HomePage());

    expect(screen.queryByRole('region', { name: STOCK_STREAM_TEXT.label })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: HOME_HERO_IMAGE.alt })).toBeInTheDocument();
  });
});

describe('the makes strip', () => {
  it('displays each make without links or a pause control', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());

    const strip = within(screen.getByRole('region', { name: MAKES_STRIP_TEXT.label }));
    expect(strip.getAllByText('Maruti Suzuki')).toHaveLength(2);
    expect(strip.queryByRole('link')).not.toBeInTheDocument();
    expect(strip.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is left out when fewer than three makes are listed', async () => {
    serve(() => response([card('a')], 1, BRANDS.slice(0, 2)));
    render(await HomePage());
    expect(screen.queryByRole('region', { name: MAKES_STRIP_TEXT.label })).not.toBeInTheDocument();
  });
});

describe('the category deck', () => {
  it('stacks the five categories in order under one heading', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());

    const deck = within(screen.getByRole('region', { name: DECK_TEXT.title }));
    expect(deck.getAllByRole('article').map((article) => article.id)).toEqual([
      'home-category-suv',
      'home-category-automatic',
      'home-category-under-10-lakh',
      'home-category-family',
      'home-category-low-km',
    ]);
    expect(deck.getAllByText('01 / 05')).toHaveLength(2);
  });

  it('shows a category’s cars and links its button to the same search on /cars', async () => {
    serve((path) =>
      path.includes('bodyType=suv') ? response(cards('suv', 3)) : response([card(path)]),
    );
    render(await HomePage());

    const suvs = category('SUVs');
    expect(suvs.getByRole('link', { name: 'Browse SUVs' })).toHaveAttribute(
      'href',
      '/cars?bodyType=suv',
    );
    expect(suvs.getByRole('link', { name: /Creta suv-0/ })).toHaveAttribute('href', '/car/suv-0');
    expect(suvs.getByRole('link', { name: /Creta suv-2/ })).toHaveAttribute('href', '/car/suv-2');
    expect(suvs.getByText('Underbody condition, tyre wear')).toBeInTheDocument();
  });

  it('keeps an empty category, says so, and sends the buyer to every car instead', async () => {
    serve((path) => (path.includes('bodyType=muv') ? response([]) : response([card(path)])));
    render(await HomePage());

    const family = category('Family cars');
    expect(family.getByText(/No family cars are listed right now/)).toBeInTheDocument();
    expect(family.queryByRole('link', { name: 'Browse family cars' })).not.toBeInTheDocument();
    expect(family.getByRole('link', { name: DECK_TEXT.seeEveryCar })).toHaveAttribute(
      'href',
      '/cars',
    );
  });

  it('marks only the featured category', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());

    expect(category('Low kilometres').getByText(DECK_TEXT.featured)).toBeInTheDocument();
    expect(category('SUVs').queryByText(DECK_TEXT.featured)).not.toBeInTheDocument();
  });
});

describe('what the homepage promotes', () => {
  it('never says how many cars the marketplace holds', async () => {
    serve(() => response(cards('c', 6), 9876));
    render(await HomePage());

    expect(document.body.textContent).not.toContain('9876');
    expect(document.body.textContent).not.toContain('9,876');
    const viewAll = screen.getByRole('link', { name: /View all/ });
    expect(viewAll).toHaveTextContent(/^View all →$/);
  });

  it('promotes only cars a buyer can act on — never a reserved one', async () => {
    serve(() =>
      response([
        ...cards('open', 5),
        card('held', { availability: 'RESERVED', title: 'Held car' }),
      ]),
    );
    render(await HomePage());

    expect(screen.queryByText('Held car')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
  });

  it('shows the four newest cars as "Recently added", linked to /cars', async () => {
    serve(() => response(cards('r', 8)));
    render(await HomePage());

    const recent = within(screen.getByRole('region', { name: 'Recently added' }));
    expect(recent.getAllByRole('article')).toHaveLength(4);
    expect(recent.getByRole('link', { name: 'View all →' })).toHaveAttribute('href', '/cars');
  });

  it('no longer claims search or enquiries are coming soon', async () => {
    serve(() => response([card('a')]));
    render(await HomePage());
    expect(screen.queryByText(/(search|enquir|saved).*coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/next features/i)).not.toBeInTheDocument();
  });
});

describe('when the marketplace cannot be reached', () => {
  /**
   * A section failing is not the page failing: the hero, the search, the
   * shortcuts and the explainers still render, and the cars' place says what
   * happened and offers to try again, rather than silently disappearing.
   */
  it('still offers the search and shortcuts, and says the cars failed', async () => {
    apiGetParsed.mockRejectedValue(new Error('down'));
    render(await HomePage());

    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: SHORTCUTS_TEXT.label })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: HOME_HERO_IMAGE.alt })).toBeInTheDocument();
    const region = within(screen.getByRole('region', { name: 'Cars on Dealers-Drive now' }));
    expect(region.getByRole('alert')).toHaveTextContent(
      'We couldn’t load these vehicles right now',
    );
    expect(region.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('down');
    expect(screen.queryByRole('region', { name: DECK_TEXT.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View all/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: JOURNEY_TEXT.title })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: AUDIENCE_TEXT.title })).toBeInTheDocument();
  });
});

function sectionOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-home-section]')).map(
    (element) => element.dataset.homeSection ?? '',
  );
}

describe('the page order', () => {
  it('runs makes, categories, recent cars, then the two explainers', async () => {
    serve((path) => response([card(path)]));
    const { container } = render(await HomePage());

    expect(sectionOrder(container)).toEqual([
      'makes',
      'categories',
      'home-recent',
      'journey',
      'audience',
    ]);
  });

  it('closes up around an empty "Recently added" row rather than leaving a band', async () => {
    serve(() => response([]));
    const { container } = render(await HomePage());
    expect(sectionOrder(container)).not.toContain('home-recent');
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
    expect(paths.filter((path) => !path.startsWith('/v1/vehicles'))).toEqual(['/v1/config/public']);
  });
});
