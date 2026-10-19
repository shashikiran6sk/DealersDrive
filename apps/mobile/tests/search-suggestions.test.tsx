import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CarSuggestion, CarSuggestResponse } from '@dealers-drive/contracts/public';
import type { VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';
import { useState } from 'react';
import type * as ReactNative from 'react-native';
import { CarSearchInput } from '../src/components/car-search-input';
import { suggestionParams } from '../src/features/cars/suggestion-params';

const mockSuggest = jest.fn<
  Promise<CarSuggestResponse>,
  [VehicleSearchParams, string, AbortSignal]
>();
const mockSelected = jest.fn();
jest.mock('../src/features/cars/cars-api', () => ({
  carsApi: {
    suggest: (params: VehicleSearchParams, value: string, signal: AbortSignal) =>
      mockSuggest(params, value, signal),
  },
}));
jest.mock('../src/components/autocomplete-field', () => {
  const { View, TextInput, Pressable, Text } =
    jest.requireActual<typeof ReactNative>('react-native');
  return {
    AutocompleteField: ({
      value,
      onChange,
      onFocusChange,
      options,
      pending,
      onSelect,
      error,
    }: {
      value: string;
      onChange: (value: string) => void;
      onFocusChange: (value: boolean) => void;
      options: { key: string; label: string }[];
      pending: boolean;
      onSelect: (key: string) => void;
      error?: string;
    }) => (
      <View>
        <TextInput
          accessibilityLabel="Search"
          value={value}
          onChangeText={onChange}
          onFocus={() => onFocusChange(true)}
          onSubmitEditing={() => onFocusChange(false)}
        />
        <Text>{pending ? 'pending' : 'ready'}</Text>
        {error ? <Text>{error}</Text> : null}
        {options.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            onPress={() => onSelect(option.key)}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
const brand: CarSuggestion = {
  kind: 'BRAND',
  label: 'Hyundai',
  metaLabel: 'Brand · 1 car',
  brand: 'hyundai',
  model: null,
  variant: null,
  count: 1,
};
const clients: QueryClient[] = [];
function Search() {
  const [value, setValue] = useState('');
  return (
    <CarSearchInput
      params={{ district: 'vellore' }}
      value={value}
      onChange={setValue}
      onSelect={mockSelected}
    />
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  mockSuggest.mockReset();
  mockSelected.mockClear();
  mockSuggest.mockImplementation((_params: unknown, value: string) =>
    Promise.resolve({ search: value, data: [brand], countLabel: '1 match' }),
  );
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  jest.useRealTimers();
});
async function search() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(cache);
  await render(
    <QueryClientProvider client={cache}>
      <Search />
    </QueryClientProvider>,
  );
  await fireEvent(screen.getByLabelText('Search'), 'focus');
}
it('debounces suggestions, selects only explicit results and does not apply text on keyboard submit', async () => {
  await search();
  await fireEvent.changeText(screen.getByLabelText('Search'), 'hy');
  expect(mockSuggest).not.toHaveBeenCalled();
  await act(() => jest.advanceTimersByTime(350));
  await waitFor(() => expect(screen.getByText('Hyundai')).toBeOnTheScreen());
  expect(mockSelected).not.toHaveBeenCalled();
  await fireEvent(screen.getByLabelText('Search'), 'submitEditing');
  expect(mockSelected).not.toHaveBeenCalled();
  await fireEvent(screen.getByLabelText('Search'), 'focus');
  await fireEvent.press(screen.getByRole('button', { name: 'Hyundai' }));
  expect(mockSelected).toHaveBeenCalledWith(brand);
});
it('hides stale rows immediately after new input and cancels an obsolete request', async () => {
  await search();
  await fireEvent.changeText(screen.getByLabelText('Search'), 'hy');
  await act(() => jest.advanceTimersByTime(350));
  await waitFor(() => expect(screen.getByText('Hyundai')).toBeOnTheScreen());
  await fireEvent.changeText(screen.getByLabelText('Search'), 'zz');
  expect(screen.queryByText('Hyundai')).toBeNull();
  await act(() => jest.advanceTimersByTime(350));
  expect(mockSuggest).toHaveBeenCalledTimes(2);
});
it('maps brand/model/variant to the shared canonical filter semantics without inventing a car destination', () => {
  expect(
    suggestionParams({ district: 'vellore', page: '4', q: 'old', model: 'old' }, brand),
  ).toEqual({ district: 'vellore', brand: 'hyundai' });
  expect(suggestionParams({}, { ...brand, kind: 'MODEL', model: 'creta' })).toEqual({
    brand: 'hyundai',
    model: 'creta',
  });
  expect(
    suggestionParams({}, { ...brand, kind: 'VARIANT', model: 'creta', variant: 'SX(O)' }),
  ).toEqual({ brand: 'hyundai', model: 'creta', q: 'SX(O)' });
});

it('aborts an in-flight obsolete query and ignores its late response', async () => {
  let finish!: (response: CarSuggestResponse) => void;
  mockSuggest.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await search();
  await fireEvent.changeText(screen.getByLabelText('Search'), 'hy');
  await act(() => jest.advanceTimersByTime(350));
  const obsolete = mockSuggest.mock.calls[0]?.[2];
  expect(obsolete?.aborted).toBe(false);
  await fireEvent.changeText(screen.getByLabelText('Search'), 'zz');
  expect(obsolete?.aborted).toBe(true);
  await act(() =>
    finish({ search: 'hy', data: [{ ...brand, label: 'Old response' }], countLabel: '1 match' }),
  );
  expect(screen.queryByText('Old response')).toBeNull();
  expect(mockSelected).not.toHaveBeenCalled();
});
