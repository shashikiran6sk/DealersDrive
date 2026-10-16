import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';
import type { PublicVehiclesResponse } from '@dealers-drive/contracts/public';
import { HomeScreen } from '../src/features/home/home-screen';
import { loadHomeSection } from '../src/features/home/load-home-section';
import { discoveryCar, emptyDiscovery } from './discovery-fixtures';

const mockHome = jest.fn<Promise<PublicVehiclesResponse>, [VehicleSearchParams]>(() =>
  Promise.resolve(emptyDiscovery),
);
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/features/location/location', () => ({
  useDistrict: () => undefined,
  useLocationReady: () => true,
  locationStore: { choose: jest.fn() },
}));
jest.mock('../src/features/dealers/dealers-api', () => ({
  dealersApi: {
    config: () => Promise.resolve({}),
    home: (params: VehicleSearchParams) => mockHome(params),
  },
}));
jest.mock('../src/features/saved/saved-provider', () => ({
  useSaved: () => ({ ready: true, isSaved: () => false, isPending: () => false }),
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  mockNavigate.mockClear();
  mockHome.mockReset();
  mockHome.mockImplementation(() => Promise.resolve(emptyDiscovery));
});

it('never submits an unselected search draft, including from keyboard Done or generic discovery', async () => {
  await home();
  await fireEvent.changeText(
    screen.getByLabelText('Search cars by make, model or variant'),
    'Creta',
  );
  await fireEvent(screen.getByLabelText('Search cars by make, model or variant'), 'submitEditing');
  expect(mockNavigate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Explore cars →' }));
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/cars', params: { district: undefined } });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
async function home() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}
it('hides every settled empty category and displays one complete-marketplace empty state', async () => {
  await home();
  await waitFor(() => expect(screen.getByText('New cars will appear here')).toBeOnTheScreen());
  for (const title of ['Recently added', 'SUVs', 'Automatic cars', 'Under ₹10 lakh'])
    expect(screen.queryByText(title)).toBeNull();
  expect(screen.queryByText('View all →')).toBeNull();
  expect(screen.queryByTestId('home-inventory-loading')).toBeNull();
});
it('keeps successful sections when another category fails and does not present failure as empty inventory', async () => {
  mockHome.mockImplementation((params) =>
    params.transmission
      ? Promise.reject(new Error('Offline'))
      : Promise.resolve({ ...emptyDiscovery, data: [discoveryCar], available: 1 }),
  );
  await home();
  await waitFor(() => expect(screen.getByText('Recently added')).toBeOnTheScreen());
  await waitFor(() =>
    expect(
      screen.getByText('Some selections could not load. Your available cars are shown above.'),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText('Automatic cars')).toBeNull();
  expect(screen.queryByText('New cars will appear here')).toBeNull();
});
it('does not flash a marketplace empty state while the authoritative request is pending', async () => {
  let finish!: (response: PublicVehiclesResponse) => void;
  mockHome.mockImplementation((params) =>
    Object.values(params).every((value) => value === undefined)
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(emptyDiscovery),
  );
  await home();
  expect(screen.getByTestId('home-inventory-loading')).toBeOnTheScreen();
  expect(screen.queryByText('New cars will appear here')).toBeNull();
  finish(emptyDiscovery);
  await waitFor(() => expect(screen.getByText('New cars will appear here')).toBeOnTheScreen());
});
it('finds available inventory after a reserved first page using existing pagination semantics', async () => {
  mockHome
    .mockResolvedValueOnce({
      ...emptyDiscovery,
      available: 1,
      data: [{ ...discoveryCar, availability: 'RESERVED' }],
      page: { page: 1, limit: 4, total: 5, totalPages: 2 },
    })
    .mockResolvedValueOnce({ ...emptyDiscovery, available: 1, data: [discoveryCar] });
  const response = await loadHomeSection({ district: 'vellore' });
  expect(response.data).toEqual([discoveryCar]);
  expect(mockHome.mock.calls[1]?.[0]).toEqual({ district: 'vellore', page: '2' });
});
it('bounds teaser pagination without converting undisplayed available inventory into a zero count', async () => {
  mockHome.mockResolvedValue({
    ...emptyDiscovery,
    available: 1,
    data: [{ ...discoveryCar, availability: 'RESERVED' }],
    page: { page: 1, limit: 4, total: 100, totalPages: 25 },
  });
  const response = await loadHomeSection({});
  expect(mockHome).toHaveBeenCalledTimes(3);
  expect(response.available).toBe(1);
  expect(response.data).toEqual([]);
});
