import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  NO_VEHICLE_FACETS,
  type PublicVehiclesResponse,
  type VehicleFacets,
} from '@dealers-drive/contracts/public';
import { FilterDialog } from '../src/features/cars/filter-dialog';
import { CARS_TEXT } from '../src/features/cars/cars.constants';

const facets: VehicleFacets = {
  ...NO_VEHICLE_FACETS,
  brands: [{ value: 'hyundai', label: 'Hyundai', count: 1 }],
  models: [{ value: 'creta', label: 'Creta', count: 1, parent: 'hyundai' }],
};
const result: PublicVehiclesResponse = {
  data: [],
  page: { page: 1, limit: 24, total: 0, totalPages: 0 },
  available: 0,
  facets,
};
const mockList = jest.fn(() => Promise.resolve(result));
jest.mock('../src/features/cars/cars-api', () => ({
  carsApi: {
    list: (...args: unknown[]) => {
      void args;
      return mockList();
    },
  },
}));
const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
async function dialog(
  params: Parameters<typeof FilterDialog>[0]['params'],
  scope: 'marketplace' | 'dealer' = 'marketplace',
) {
  const apply = jest.fn();
  const close = jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <FilterDialog
        params={params}
        scope={scope}
        facets={facets}
        locations={undefined}
        onApply={apply}
        onClose={close}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockList).toHaveBeenCalled());
  return { apply, close };
}
it('switches to all districts while preserving non-location filters', async () => {
  const h = await dialog({
    district: 'vellore',
    city: 'katpadi',
    dealer: 'sri-motors',
    brand: 'hyundai',
    minPrice: '50000000',
    page: '3',
  });
  await fireEvent.press(screen.getByRole('checkbox', { name: CARS_TEXT.allDistricts }));
  await fireEvent.press(screen.getByRole('button', { name: CARS_TEXT.apply }));
  expect(h.apply).toHaveBeenCalledWith({ brand: 'hyundai', minPrice: '50000000' });
});
it('drops orphaned models when their selected brand is removed', async () => {
  const h = await dialog({ brand: 'hyundai', model: 'creta', page: '3' });
  await fireEvent.press(screen.getByRole('checkbox', { name: /^Hyundai(?: \(1\))?$/ }));
  await fireEvent.press(screen.getByRole('button', { name: CARS_TEXT.apply }));
  expect(h.apply).toHaveBeenCalledWith({});
});
it('refuses inverted ranges instead of applying silently empty search', async () => {
  const h = await dialog({ minPrice: '50000000' });
  await fireEvent.press(screen.getByRole('button', { name: 'Price' }));
  await fireEvent.changeText(
    screen.getByLabelText(`${CARS_TEXT.customPrice} ${CARS_TEXT.rangeMax}`),
    '100',
  );
  await fireEvent.press(screen.getByRole('button', { name: CARS_TEXT.apply }));
  expect(h.apply).not.toHaveBeenCalled();
  expect(screen.getByText(CARS_TEXT.invalidFilter)).toBeOnTheScreen();
});

it('keeps dealership inventory filters scoped and omits district/town/dealer controls', async () => {
  await dialog({ brand: 'hyundai' }, 'dealer');
  expect(screen.queryByLabelText(CARS_TEXT.district)).toBeNull();
  expect(screen.queryByText('City / Town')).toBeNull();
  expect(screen.queryByText('Dealer')).toBeNull();
  expect(screen.queryByText(CARS_TEXT.sort)).toBeNull();
  expect(screen.queryByText('Newest first')).toBeNull();
});

it('discards town and dealer dependencies immediately when the district draft is reset', async () => {
  const apply = jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <FilterDialog
        params={{ district: 'vellore', city: 'katpadi', dealer: 'test-dealer', fuel: 'petrol' }}
        facets={{ ...facets, cities: [{ value: 'katpadi', label: 'Katpadi', count: 1 }] }}
        locations={undefined}
        onApply={apply}
        onClose={jest.fn()}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('checkbox', { name: /^Katpadi/ })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('checkbox', { name: CARS_TEXT.allDistricts }));
  expect(screen.queryByRole('checkbox', { name: /^Katpadi/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: CARS_TEXT.apply }));
  expect(apply).toHaveBeenCalledWith({ fuel: 'petrol' });
});
