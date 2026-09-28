import {
  NO_VEHICLE_FACETS,
  type PublicLocations,
  type PublicVehiclesResponse,
  type VehicleCardDto,
} from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CarsPage from '@/app/(public)/cars/page';
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle/vehicle-card';
import type * as ApiModule from '@/lib/api';

import { FACETS } from '../search/fixtures';

import { setLocation } from '../../../setup';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

function card(overrides: Partial<VehicleCardDto> = {}): VehicleCardDto {
  return {
    slug: '2023-hyundai-creta-sx-o-katpadi-3f9a1c2b',
    title: '2023 Hyundai Creta SX(O)',
    year: 2023,
    priceLabel: '₹14,50,000',
    metaLabel: '22,400 km · Petrol · Automatic · Katpadi',
    image: {
      url: 'https://media.test/by-media/m1/640.webp',
      alt: '2023 Hyundai Creta SX(O), the primary photograph',
    },
    imageCount: 8,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
    ...overrides,
  };
}

function response(data: VehicleCardDto[], page = 1, totalPages = 1): PublicVehiclesResponse {
  return {
    data,
    page: { page, limit: 24, total: data.length, totalPages },
    facets: NO_VEHICLE_FACETS,
  };
}

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
  ],
  total: 22,
  cars: { total: 40, districts: { vellore: 25, ranipet: 15 } },
};

/** The page reads two things — the cars, and the districts the header offers. */
function serve(vehicles: PublicVehiclesResponse): void {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
    Promise.resolve(path === '/v1/locations' ? LOCATIONS : vehicles),
  );
}

afterEach(() => {
  apiGetParsed.mockReset();
});

describe('VehicleCard', () => {
  it('draws the year plate, title, price, meta row and dealer strip', () => {
    render(<VehicleCard vehicle={card()} />);

    const article = screen.getByRole('article');
    expect(within(article).getByText('2023', { selector: '.dd-plate' })).toBeInTheDocument();
    expect(within(article).getByRole('link', { name: '2023 Hyundai Creta SX(O)' })).toHaveAttribute(
      'href',
      '/car/2023-hyundai-creta-sx-o-katpadi-3f9a1c2b',
    );
    expect(within(article).getByText('₹14,50,000')).toBeInTheDocument();
    expect(
      within(article).getByText('22,400 km · Petrol · Automatic · Katpadi'),
    ).toBeInTheDocument();
    expect(within(article).getByText('Sri Lakshmi Motors')).toBeInTheDocument();
    expect(within(article).getByText('Verified')).toBeInTheDocument();
  });

  it('shows the primary photograph', () => {
    render(<VehicleCard vehicle={card()} />);
    expect(
      screen.getByRole('img', { name: '2023 Hyundai Creta SX(O), the primary photograph' }),
    ).toHaveAttribute('src', 'https://media.test/by-media/m1/640.webp');
  });

  it('holds the image band with a labelled slot when there is no photograph', () => {
    render(<VehicleCard vehicle={card({ image: null })} />);
    expect(screen.getByRole('img', { name: 'Photographs coming soon' })).toBeInTheDocument();
  });

  it('says the price is on request rather than printing nothing, and drops a missing year', () => {
    render(<VehicleCard vehicle={card({ priceLabel: null, year: null })} />);
    expect(screen.getByText('Price on request')).toBeInTheDocument();
    expect(document.querySelector('.dd-plate')).toBeNull();
  });

  it('marks a dealer that is not verified without the tag', () => {
    render(<VehicleCard vehicle={card({ dealer: { ...card().dealer, isVerified: false } })} />);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('loads the first cards eagerly and the rest lazily', () => {
    render(
      <>
        <VehicleCard vehicle={card()} priority />
        <VehicleCard vehicle={card({ slug: 'other' })} />
      </>,
    );
    const [first, second] = screen.getAllByRole('img');
    expect(first).toHaveAttribute('loading', 'eager');
    expect(second).toHaveAttribute('loading', 'lazy');
  });

  it('has a skeleton that is hidden from assistive technology', () => {
    const { container } = render(<VehicleCardSkeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('/cars', () => {
  it('reads the first page and renders a card for each car with the count', async () => {
    serve(response([card(), card({ slug: 'b', title: '2021 Tata Nexon' })]));
    render(await CarsPage({ searchParams: Promise.resolve({}) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/vehicles', {
      revalidate: 60,
      tags: ['vehicles'],
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Used cars' })).toBeInTheDocument();
    expect(screen.getByText('2 cars available')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('asks for the page in the URL and links to its neighbours', async () => {
    serve(response([card()], 2, 3));
    render(await CarsPage({ searchParams: Promise.resolve({ page: '2' }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/vehicles?page=2', {
      revalidate: 60,
      tags: ['vehicles'],
    });
    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));
    expect(nav.getByRole('link', { name: '← Previous' })).toHaveAttribute('href', '/cars');
    expect(nav.getByRole('link', { name: 'Next →' })).toHaveAttribute('href', '/cars?page=3');
    expect(nav.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('ignores a page that is not a page', async () => {
    serve(response([card()]));
    render(await CarsPage({ searchParams: Promise.resolve({ page: 'drop table' }) }));
    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/vehicles', expect.anything());
  });

  it('says honestly when nothing is listed yet, and points at the dealers', async () => {
    serve(response([]));
    render(await CarsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('No cars listed yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse dealers' })).toHaveAttribute(
      'href',
      '/dealers',
    );
  });
});

/**
 * R50 — `/cars` scoped by the header's district. The URL is the state: the
 * page reads `?district=`, asks the API for it, and carries it through every
 * link it draws.
 */
describe('/cars in one district', () => {
  it('asks for the district in the URL, and names it in the heading', async () => {
    setLocation('/cars', 'district=ranipet');
    serve(response([card()]));
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet' }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/vehicles?district=ranipet',
      expect.anything(),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Cars in Ranipet' })).toBeInTheDocument();
    expect(screen.getByText('1 car available')).toBeInTheDocument();
    expect(screen.getByText('District: Ranipet, Tamil Nadu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change district/i })).toBeInTheDocument();
  });

  it('keeps the district on the way to the next page and back', async () => {
    serve(response([card()], 2, 3));
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet', page: '2' }) }));

    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));
    expect(nav.getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/cars?district=ranipet',
    );
    expect(nav.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/cars?district=ranipet&page=3',
    );
  });

  it('says there is nothing in that district, and offers every district', async () => {
    serve(response([]));
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet' }) }));

    expect(screen.getByText('No cars found in Ranipet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show all districts' })).toHaveAttribute(
      'href',
      '/cars',
    );
  });

  it('offers to choose a district when none is chosen', async () => {
    setLocation('/cars');
    serve(response([card()]));
    render(await CarsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('button', { name: /select district/i })).toBeInTheDocument();
    expect(screen.getByText(/showing cars in every district/i)).toBeInTheDocument();
  });

  it('does not pass a district that is not a slug on to the API', async () => {
    serve(response([card()]));
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'Ranipet; drop' }) }));
    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/vehicles', expect.anything());
  });
});

/**
 * F078 — the page reads every filter from the URL, asks the API for exactly
 * that, and draws the panel and the chips from the facets it gets back.
 */
describe('/cars with filters', () => {
  function withFacets(response: PublicVehiclesResponse): PublicVehiclesResponse {
    return { ...response, facets: FACETS };
  }

  it('passes the filters in the URL on to the API, in one canonical order', async () => {
    serve(withFacets(response([card()])));
    render(
      await CarsPage({
        searchParams: Promise.resolve({
          fuel: 'petrol,diesel',
          district: 'ranipet',
          brand: 'hyundai',
          utm_source: 'x',
        }),
      }),
    );
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/vehicles?district=ranipet&brand=hyundai&fuel=petrol%2Cdiesel',
      expect.anything(),
    );
  });

  it('drops a filter the API would refuse, rather than failing the page', async () => {
    serve(withFacets(response([card()])));
    render(await CarsPage({ searchParams: Promise.resolve({ fuel: 'kerosene', brand: 'kia' }) }));
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/vehicles?brand=kia',
      expect.anything(),
    );
  });

  it('draws the filter panel and the applied chips from the response', async () => {
    setLocation('/cars', 'district=ranipet&fuel=petrol');
    serve(withFacets(response([card()])));
    render(
      await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet', fuel: 'petrol' }) }),
    );
    const panel = screen.getByRole('complementary', { name: 'Filter cars' });
    expect(within(panel).getByRole('checkbox', { name: 'Petrol (18 cars)' })).toBeChecked();
    expect(within(panel).getByRole('group', { name: 'City / Town' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter: Petrol' })).toBeInTheDocument();
  });

  it('says nothing matches, and offers to clear the filters but keep the district', async () => {
    serve(withFacets(response([])));
    render(
      await CarsPage({
        searchParams: Promise.resolve({ district: 'ranipet', fuel: 'cng', q: 'creta' }),
      }),
    );
    expect(
      screen.getByText('No cars found in Ranipet matching these filters.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/cars?district=ranipet',
    );
  });

  it('says nothing matches without a district too', async () => {
    serve(withFacets(response([])));
    render(await CarsPage({ searchParams: Promise.resolve({ transmission: 'automatic' }) }));
    expect(screen.getByText('No vehicles match your current filters.')).toBeInTheDocument();
  });

  it('keeps every filter on the way to the next page', async () => {
    serve(withFacets(response([card()], 1, 3)));
    render(
      await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet', fuel: 'petrol' }) }),
    );
    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));
    expect(nav.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/cars?district=ranipet&fuel=petrol&page=2',
    );
  });

  it('announces the total as a status, so a screen reader hears it change', async () => {
    serve(withFacets(response([card(), card({ slug: 'b' })])));
    render(await CarsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('status')).toHaveTextContent('2 cars available');
  });
});

/** F080 — the search box and the sort sit in the title row, reading the URL. */
describe('/cars search and sort', () => {
  it('shows the search and the order the URL carries, and asks the API for them', async () => {
    serve({ ...response([card()]), facets: FACETS });
    render(await CarsPage({ searchParams: Promise.resolve({ q: 'creta', sort: 'price_desc' }) }));
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/vehicles?q=creta&sort=price_desc',
      expect.anything(),
    );
    expect(screen.getByRole('combobox', { name: /search cars by make/i })).toHaveValue('creta');
    expect(screen.getByRole('combobox', { name: 'Sort cars' })).toHaveValue('price_desc');
  });
});

/**
 * R55 — the controls read in the order `/dealers` uses: the search first, then
 * the district, then the sort (and on a phone the Filters button) at the end.
 */
describe('/cars controls row', () => {
  it('puts the search, the district and the sort in one group, in that order', async () => {
    setLocation('/cars', 'district=ranipet');
    serve({ ...response([card()]), facets: FACETS });
    render(await CarsPage({ searchParams: Promise.resolve({ district: 'ranipet' }) }));
    const row = screen.getByRole('group', { name: 'Search, district and sort' });
    const search = within(row).getByRole('combobox', { name: /search cars by make/i });
    const district = within(row).getByRole('button', { name: /change district/i });
    const sort = within(row).getByRole('combobox', { name: 'Sort cars' });
    expect(
      search.compareDocumentPosition(district) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(district.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(row).queryByRole('searchbox')).toBeNull();
  });
});

/** F079 — below `lg` the rail is hidden and the same panel opens as a sheet. */
describe('/cars on a phone', () => {
  it('puts a Filters button beside the sort, counting what is applied', async () => {
    serve({ ...response([card()]), facets: FACETS });
    render(
      await CarsPage({
        searchParams: Promise.resolve({ fuel: 'petrol', minKm: '0', maxKm: '20000' }),
      }),
    );
    const button = screen.getByRole('button', { name: 'Filters, 2 filters applied' });
    expect(button).toHaveClass('lg:hidden');
    expect(screen.getByRole('complementary', { name: 'Filter cars' })).toHaveClass(
      'hidden',
      'lg:block',
    );
  });
});
