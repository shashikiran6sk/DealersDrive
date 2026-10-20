import type * as ReactNativeModule from 'react-native';
import { FlatList } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  VEHICLE_SORT_LABELS,
  type DealerPublicProfile,
  type PublicVehiclesResponse,
} from '@dealers-drive/contracts/public';
import { DealerProfileScreen } from '../src/features/dealers/dealer-profile-screen';
import { DEALERS_TEXT } from '../src/features/dealers/dealers.constants';
import { inventoryOffset } from '../src/features/dealers/dealer-profile-screen/utils';
import { discoveryCar, emptyDiscovery } from './discovery-fixtures';

let mockParams: Record<string, string | undefined> = { slug: 'test-dealer' };
const mockRouter = {
  navigate: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
  setParams: jest.fn((next: Record<string, string | undefined>) => {
    mockParams = { ...mockParams, ...next };
  }),
};
const mockProfile = jest.fn<Promise<DealerPublicProfile>, []>();
const mockInventory = jest.fn<Promise<PublicVehiclesResponse>, [Record<string, string>]>();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}));
jest.mock('../src/features/dealers/dealers-api', () => ({
  dealersApi: {
    profile: () => mockProfile(),
    inventory: (_slug: string, params: Record<string, string>) => mockInventory(params),
  },
}));
jest.mock('../src/features/saved/saved-provider', () => ({
  useSaved: () => ({
    isSaved: () => false,
    isPending: () => false,
    ready: true,
    toggle: jest.fn(),
    error: null,
    retry: jest.fn(),
  }),
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof ReactNativeModule>('react-native');
  return { __esModule: true, default: View, Path: View, SvgXml: View };
});

const profile = (services: string[]): DealerPublicProfile => ({
  slug: 'test-dealer',
  brandName: 'Test dealership',
  legalName: 'Test dealership Pvt Ltd',
  initials: 'TD',
  isVerified: true,
  tagline: null,
  services,
  address: {
    line: null,
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: null,
    full: 'Vellore, Tamil Nadu',
    mapsUrl: null,
    geo: null,
    embedUrl: null,
  },
  stats: [],
  contact: [],
  logoUrl: null,
  coverUrl: null,
  portfolio: [],
  seo: { canonical: '/dealers/test-dealer', title: 'Test dealership', isIndexable: true },
});
const stock = (slug: string): PublicVehiclesResponse => ({
  ...emptyDiscovery,
  data: [{ ...discoveryCar, slug, title: `Car ${slug}` }],
  available: 1,
  page: { page: 1, limit: 24, total: 1, totalPages: 1 },
});
const clients: QueryClient[] = [];
function tree() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  return (
    <QueryClientProvider client={client}>
      <DealerProfileScreen />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  mockParams = { slug: 'test-dealer' };
  jest.clearAllMocks();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

it('shows only the server-provided services as pills and hides the section without any', async () => {
  mockProfile.mockResolvedValue(profile(['Finance', ' Exchange ', 'finance', '']));
  mockInventory.mockResolvedValue(stock('one'));
  const view = await render(tree());
  expect(await screen.findByText('Finance')).toBeOnTheScreen();
  expect(screen.getByText('Exchange')).toBeOnTheScreen();
  expect(screen.getAllByText(/finance/i)).toHaveLength(1);
  expect(screen.getByLabelText(DEALERS_TEXT.services)).toHaveProp('accessibilityRole', 'list');
  mockProfile.mockResolvedValue(profile([]));
  await view.unmount();
  await render(tree());
  expect(await screen.findByText('Car one')).toBeOnTheScreen();
  expect(screen.queryByText(DEALERS_TEXT.services)).toBeNull();
});
it('keeps the inventory tools and previous cars while a new sort loads, then returns to the inventory heading', async () => {
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
  mockProfile.mockResolvedValue(profile([]));
  mockInventory.mockResolvedValueOnce(stock('one'));
  let finish: (value: PublicVehiclesResponse) => void = () => undefined;
  mockInventory.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = await render(tree());
  expect(await screen.findByText('Car one')).toBeOnTheScreen();
  await act(async () => {
    await fireEvent(screen.getByTestId('dealer-inventory-heading'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 900, width: 300, height: 30 } },
    });
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Sort' }));
  await fireEvent.press(screen.getByRole('radio', { name: VEHICLE_SORT_LABELS.price_asc }));
  expect(scroll).toHaveBeenCalledWith({ offset: inventoryOffset(900), animated: true });
  await view.rerender(tree());
  await waitFor(() => expect(mockInventory).toHaveBeenCalledTimes(2));
  expect(mockInventory.mock.calls[1]?.[0]).toMatchObject({ sort: 'price_asc' });
  expect(screen.getByText('Car one')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sort' })).toBeOnTheScreen();
  expect(screen.getByTestId('dealer-inventory-updating')).toBeOnTheScreen();
  await act(() => finish(stock('two')));
  expect(await screen.findByText('Car two')).toBeOnTheScreen();
  expect(screen.queryByTestId('dealer-inventory-updating')).toBeNull();
  scroll.mockRestore();
});
it('keeps the heading and tools when a filtered request fails', async () => {
  mockParams = { slug: 'test-dealer', sort: 'price_asc' };
  mockProfile.mockResolvedValue(profile([]));
  mockInventory.mockRejectedValue(new Error('Cars could not load.'));
  await render(tree());
  expect(await screen.findByText('Cars could not load.')).toBeOnTheScreen();
  expect(screen.getByTestId('dealer-inventory-heading')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sort' })).toBeOnTheScreen();
});
