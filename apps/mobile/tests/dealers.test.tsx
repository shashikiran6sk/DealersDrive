import { fireEvent, render, screen } from '@testing-library/react-native';
import type { DealerCard as Dealer } from '@dealers-drive/contracts/public';
import { DealerCard } from '../src/components/dealer-card';
import { createDealersApi } from '../src/features/dealers/dealers-api';
import { createApiClient } from '../src/services/api';
import { CARS_TEXT } from '../src/features/cars/cars.constants';

const dealer: Dealer = {
  slug: 'sri-motors',
  brandName: 'Sri Motors',
  initials: 'SM',
  city: 'Vellore',
  state: 'Tamil Nadu',
  yearsOperating: 7,
  yearsLabel: 'Vellore, Tamil Nadu · 7 years',
  tagline: null,
  services: ['Used cars'],
  carCount: 3,
  fromPricePaise: 50000000,
  fromPriceLabel: 'From ₹5,00,000',
  isVerified: true,
  logoUrl: null,
  coverUrl: null,
};
it('uses server-composed dealership information and conceptual cover without contact leakage', async () => {
  const open = jest.fn();
  await render(<DealerCard dealer={dealer} onPress={open} />);
  expect(screen.getByText(dealer.brandName)).toBeOnTheScreen();
  expect(screen.getByText(dealer.fromPriceLabel)).toBeOnTheScreen();
  expect(screen.getByText(CARS_TEXT.verified)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button'));
  expect(open).toHaveBeenCalledTimes(1);
});
it('preserves directory scope and pagination using public-only requests', async () => {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [],
        page: { page: 2, limit: 24, total: 0, totalPages: 0 },
        countLabel: '0 dealers',
        cities: [],
        districts: [],
      }),
      { status: 200 },
    ),
  );
  const api = createDealersApi(createApiClient({ baseUrl: 'https://api.example.test', fetcher }));
  await api.directory({ district: 'vellore', city: 'katpadi', q: 'sri' }, 2);
  const requested = fetcher.mock.calls[0]?.[0];
  if (typeof requested !== 'string') throw new Error('Expected a service URL.');
  const url = new URL(requested);
  expect(url.pathname).toBe('/v1/dealers');
  expect(url.searchParams.get('district')).toBe('vellore');
  expect(url.searchParams.get('page')).toBe('2');
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
});
it('keeps dealership inventory location fixed rather than sending unsupported public location filters', async () => {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [],
        page: { page: 1, limit: 24, total: 0, totalPages: 0 },
        available: 0,
        facets: {
          cities: [],
          brands: [],
          models: [],
          fuelTypes: [],
          transmissions: [],
          bodyTypes: [],
          colors: [],
          ownerCounts: [],
          dealers: [],
          years: [],
          price: [],
          kilometers: [],
        },
      }),
      { status: 200 },
    ),
  );
  const api = createDealersApi(createApiClient({ baseUrl: 'https://api.example.test', fetcher }));
  await api.inventory(
    'sri-motors',
    { district: 'other', city: 'other', dealer: 'other', fuel: 'petrol' },
    1,
  );
  const requested = fetcher.mock.calls[0]?.[0];
  if (typeof requested !== 'string') throw new Error('Expected a service URL.');
  const url = new URL(requested);
  expect(url.pathname).toBe('/v1/dealers/sri-motors/vehicles');
  expect(url.searchParams.get('fuel')).toBe('petrol');
  for (const key of ['district', 'city', 'dealer']) expect(url.searchParams.has(key)).toBe(false);
});
