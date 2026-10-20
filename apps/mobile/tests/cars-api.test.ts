import { createCarsApi } from '../src/features/cars/cars-api';
import { createApiClient } from '../src/services/api';
import {
  clearFilters,
  readVehicleSearch,
  searchHref,
  setParam,
  setRange,
  PRICE_KEYS,
  toggleCsv,
} from '@dealers-drive/contracts/vehicle-search';
import { PublicVehicleQuery } from '@dealers-drive/contracts/public';

it('reuses web search normalization, inclusive paise ranges and deterministic paging resets', () => {
  const initial = readVehicleSearch({
    district: 'vellore',
    city: 'katpadi',
    q: '  Creta  ',
    page: '3',
    minPrice: '100',
    maxPrice: '50',
    unknown: 'admin',
  });
  expect(initial).not.toHaveProperty('unknown');
  expect(initial).not.toHaveProperty('minPrice');
  expect(setParam(initial, 'q', 'SX')).not.toHaveProperty('page');
  expect(clearFilters(initial)).toEqual({ district: 'vellore', q: 'Creta' });
  const range = setRange({}, PRICE_KEYS, 50_000_000, 100_000_000);
  expect(PublicVehicleQuery.parse(range).minPrice).toBe(50_000_000);
  expect(searchHref('/v1/vehicles', toggleCsv({ sort: 'newest' }, 'fuel', 'petrol'))).toBe(
    '/v1/vehicles?fuel=petrol',
  );
});
it('calls existing customer-public search paths and sends no credentials', async () => {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
    new Response(JSON.stringify({ search: 'creta', data: [], countLabel: 'No matches' }), {
      status: 200,
    }),
  );
  const api = createCarsApi(createApiClient({ baseUrl: 'https://api.example.test', fetcher }));
  await api.suggest({ district: 'vellore', city: 'katpadi' }, 'creta');
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/v1/search/vehicles?search=creta&district=vellore&city=katpadi',
  );
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
  expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('omit');
});
