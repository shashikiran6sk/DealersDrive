import type * as ReactNativeModule from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PublicVehicleDetail } from '@dealers-drive/contracts/public';
import { CarDetailScreen } from '../src/features/cars/car-detail-screen';
import { CARS_TEXT } from '../src/features/cars/cars.constants';
import { emptyDiscovery } from './discovery-fixtures';

const mockSimilar = emptyDiscovery;

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: 'test-creta' }),
  useRouter: () => ({ navigate: mockNavigate, back: jest.fn(), canGoBack: () => true }),
}));
const mockDetail: PublicVehicleDetail = {
  slug: 'test-creta',
  availability: 'AVAILABLE',
  title: '2023 Hyundai Creta',
  year: 2023,
  priceLabel: '₹10,00,000',
  negotiabilityLabel: null,
  summary: 'Petrol · Automatic',
  description: null,
  specs: [],
  images: [],
  primaryIndex: 0,
  publishedLabel: null,
  facts: {
    make: null,
    model: null,
    variant: null,
    bodyType: null,
    fuelType: null,
    transmission: null,
    color: null,
    kilometersDriven: null,
    ownerCount: null,
    pricePaise: null,
  },
  dealer: {
    name: 'Test dealership',
    slug: 'test-dealer',
    initials: 'TD',
    isVerified: true,
    location: 'Vellore',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
  },
};
jest.mock('../src/features/cars/cars-api', () => ({
  carsApi: {
    detail: () => Promise.resolve(mockDetail),
    similar: () => Promise.resolve(mockSimilar),
  },
}));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: { pending: { peek: () => null, clear: jest.fn() } } }),
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

const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
it('places View dealership after the dealership identity, badge and guidance', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const view = await render(
    <QueryClientProvider client={client}>
      <CarDetailScreen />
    </QueryClientProvider>,
  );
  const action = await screen.findByRole('button', { name: CARS_TEXT.viewDealer });
  const text = JSON.stringify(view.toJSON());
  const order = [
    text.indexOf(CARS_TEXT.soldBy),
    text.indexOf('Test dealership'),
    text.indexOf(CARS_TEXT.verified),
    text.indexOf(CARS_TEXT.trust),
    text.indexOf(CARS_TEXT.viewDealer),
  ];
  expect(order.every((position) => position >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await fireEvent.press(action);
  expect(mockNavigate).toHaveBeenCalledWith('/dealers/test-dealer');
});
