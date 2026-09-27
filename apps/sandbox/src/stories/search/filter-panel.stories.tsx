import { KM_PRESETS, PRICE_PRESETS, type VehicleFacets } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { FilterPanel, PORTFOLIO_FILTER_GROUPS } from '@/components/search/filter-panel';
import { SearchNavigationProvider } from '@/components/search/search-navigation';

const FACETS: VehicleFacets = {
  cities: [
    { value: 'arcot', label: 'Arcot', count: 11 },
    { value: 'ranipet', label: 'Ranipet', count: 11 },
    { value: 'arakkonam', label: 'Arakkonam', count: 9 },
    { value: 'walajapet', label: 'Walajapet', count: 8 },
  ],
  brands: [
    { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 11 },
    { value: 'hyundai', label: 'Hyundai', count: 6 },
    { value: 'tata', label: 'Tata', count: 6 },
    { value: 'honda', label: 'Honda', count: 5 },
    { value: 'kia', label: 'Kia', count: 4 },
    { value: 'mahindra', label: 'Mahindra', count: 3 },
    { value: 'toyota', label: 'Toyota', count: 3 },
    { value: 'skoda', label: 'Skoda', count: 1 },
  ],
  models: [],
  fuelTypes: [
    { value: 'petrol', label: 'Petrol', count: 18 },
    { value: 'cng', label: 'CNG', count: 12 },
    { value: 'diesel', label: 'Diesel', count: 8 },
    { value: 'hybrid', label: 'Hybrid', count: 1 },
  ],
  transmissions: [
    { value: 'manual', label: 'Manual', count: 20 },
    { value: 'automatic', label: 'Automatic', count: 19 },
  ],
  bodyTypes: [
    { value: 'suv', label: 'SUV', count: 15 },
    { value: 'hatchback', label: 'Hatchback', count: 13 },
    { value: 'muv', label: 'MUV', count: 6 },
    { value: 'sedan', label: 'Sedan', count: 5 },
  ],
  colors: [
    { value: 'black', label: 'Black', count: 3 },
    { value: 'white', label: 'White', count: 9 },
    { value: 'grey', label: 'Grey', count: 5 },
    { value: 'silver', label: 'Silver', count: 6 },
    { value: 'red', label: 'Red', count: 7 },
    { value: 'blue', label: 'Blue', count: 2 },
    { value: 'green', label: 'Green', count: 0 },
    { value: 'brown', label: 'Brown', count: 1 },
    { value: 'beige', label: 'Beige', count: 0 },
    { value: 'yellow', label: 'Yellow', count: 0 },
    { value: 'orange', label: 'Orange', count: 1 },
    { value: 'other', label: 'Other', count: 0 },
  ],
  ownerCounts: [
    { value: '1', label: 'First owner', count: 20 },
    { value: '2', label: 'Second owner', count: 12 },
    { value: '3', label: 'Third owner', count: 5 },
    { value: '4', label: 'Fourth owner or more', count: 2 },
  ],
  dealers: [
    { value: 'arcot-city-cars', label: 'Arcot City Cars', count: 5 },
    { value: 'palar-bridge-autos', label: 'Palar Bridge Autos', count: 4 },
    { value: 'ranipet-auto-world', label: 'Ranipet Auto World', count: 4 },
  ],
  years: ['2024', '2023', '2022', '2021', '2020', '2019', '2018'].map((year, index) => ({
    value: year,
    label: year,
    count: 8 - index,
  })),
  price: PRICE_PRESETS.map((preset, index) => ({
    ...preset,
    count: [12, 18, 6, 2, 0][index] ?? 0,
  })),
  kilometers: KM_PRESETS.map((preset, index) => ({
    ...preset,
    count: [2, 14, 13, 9, 1][index] ?? 0,
  })),
};

const meta = {
  title: 'Search/FilterPanel',
  component: FilterPanel,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
  },
  decorators: [
    (Story) => (
      <SearchNavigationProvider>
        <div className="w-[250px]">
          <Story />
        </div>
      </SearchNavigationProvider>
    ),
  ],
  args: { facets: FACETS, params: { district: 'ranipet' }, basePath: '/cars' },
} satisfies Meta<typeof FilterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingSelected: Story = {};

export const EveryDistrict: Story = {
  args: { facets: { ...FACETS, cities: [] }, params: {} },
};

export const SeveralGroups: Story = {
  args: {
    params: { district: 'ranipet', city: 'arcot', fuel: 'petrol,cng', transmission: 'automatic' },
  },
};

export const BrandChosen: Story = {
  args: {
    facets: {
      ...FACETS,
      models: [
        { value: 'creta', label: 'Creta', count: 3, parent: 'hyundai' },
        { value: 'venue', label: 'Venue', count: 2, parent: 'hyundai' },
        { value: 'i20', label: 'i20', count: 1, parent: 'hyundai' },
      ],
    },
    params: { district: 'ranipet', brand: 'hyundai', model: 'creta' },
  },
};

export const PriceAndYear: Story = {
  args: {
    params: { minPrice: '50000000', maxPrice: '100000000', minYear: '2020', maxYear: '2023' },
  },
};

export const CustomRange: Story = {
  args: { params: { minKm: '5000', maxKm: '25000' } },
};

export const PortfolioSubset: Story = {
  args: {
    facets: { ...FACETS, cities: [], dealers: [] },
    params: { fuel: 'petrol' },
    basePath: '/dealers/arcot-city-cars',
    groups: PORTFOLIO_FILTER_GROUPS,
    heading: 'Filter inventory',
  },
};

export const NothingToFilter: Story = {
  args: {
    facets: {
      ...FACETS,
      cities: [],
      brands: [],
      fuelTypes: [],
      transmissions: [],
      bodyTypes: [],
      colors: [],
      ownerCounts: [],
      dealers: [],
      years: [],
      price: FACETS.price.map((band) => ({ ...band, count: 0 })),
      kilometers: FACETS.kilometers.map((band) => ({ ...band, count: 0 })),
    },
    params: {},
  },
};
