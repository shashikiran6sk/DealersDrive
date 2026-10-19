import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { DealerDirectoryResponse } from '@dealers-drive/contracts/public';
import type { DirectoryParams } from '../src/features/dealers/dealers-api';
import { DealerDirectoryScreen } from '../src/features/dealers/dealer-directory-screen';
import { locationStore } from '../src/features/location/location';

let mockRoute: Record<string, string | undefined> = {};
const mockRouter = {
  navigate: jest.fn(),
  setParams: jest.fn((patch: Record<string, string | undefined>) => {
    mockRoute = { ...mockRoute, ...patch };
  }),
};
const testDealers: DealerDirectoryResponse['data'] = ['Katpadi', 'Vellore'].map((city) => ({
  slug: `test-${city.toLowerCase()}`,
  brandName: `${city} Motors`,
  initials: 'TM',
  city,
  state: 'Tamil Nadu',
  yearsOperating: 1,
  yearsLabel: `${city} · 1 year`,
  tagline: null,
  services: [],
  carCount: 0,
  fromPricePaise: null,
  fromPriceLabel: '—',
  isVerified: false,
  logoUrl: null,
  coverUrl: null,
}));
const mockDirectory = jest.fn<Promise<DealerDirectoryResponse>, [DirectoryParams, number]>(
  (params) => {
    const data = testDealers.filter(
      (dealer) => !params.city || params.city.split(',').includes(dealer.city?.toLowerCase() ?? ''),
    );
    return Promise.resolve({
      data,
      countLabel: `${data.length} ${data.length === 1 ? 'dealership' : 'dealerships'}`,
      cities: [
        { slug: 'katpadi', name: 'Katpadi', count: 1 },
        { slug: 'vellore', name: 'Vellore', count: 1 },
      ],
      districts: [],
      page: { page: 1, limit: 24, total: data.length, totalPages: 1 },
    });
  },
);
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockRoute,
  useIsFocused: () => true,
}));
jest.mock('../src/features/dealers/dealers-api', () => ({
  dealersApi: { directory: (params: DirectoryParams, page: number) => mockDirectory(params, page) },
}));
let client: QueryClient;
beforeEach(() => {
  mockRoute = { district: 'vellore', city: 'katpadi,vellore', q: 'motors' };
  locationStore.setState({ district: 'vellore', hydrated: true, revision: 0 });
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());
it('honors directory deep-link scope and removes one town while preserving district and text search', async () => {
  const view = await render(
    <QueryClientProvider client={client}>
      <DealerDirectoryScreen />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(mockDirectory).toHaveBeenCalledWith(
      { district: 'vellore', city: 'katpadi,vellore', q: 'motors' },
      1,
    ),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: 'Katpadi, 1 dealership', checked: true }),
    ).toBeOnTheScreen(),
  );
  await fireEvent.press(
    screen.getByRole('checkbox', { name: 'Katpadi, 1 dealership', checked: true }),
  );
  expect(mockRouter.setParams).toHaveBeenCalledWith({
    district: 'vellore',
    city: 'vellore',
    q: 'motors',
    page: undefined,
  });
  await view.rerender(
    <QueryClientProvider client={client}>
      <DealerDirectoryScreen />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(mockDirectory).toHaveBeenCalledWith(
      { district: 'vellore', city: 'vellore', q: 'motors' },
      1,
    ),
  );
  await waitFor(() => expect(screen.getByText('1 dealership')).toBeOnTheScreen());
});
