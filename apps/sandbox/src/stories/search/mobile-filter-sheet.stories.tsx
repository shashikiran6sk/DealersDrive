import { KM_PRESETS, PRICE_PRESETS, type VehicleFacets } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PORTFOLIO_FILTER_GROUPS } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { SearchNavigationProvider } from '@/components/search/search-navigation';

const FACETS: VehicleFacets = {
  cities: [
    { value: 'arcot', label: 'Arcot', count: 11 },
    { value: 'ranipet', label: 'Ranipet', count: 11 },
    { value: 'arakkonam', label: 'Arakkonam', count: 9 },
  ],
  brands: [
    { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 11 },
    { value: 'hyundai', label: 'Hyundai', count: 6 },
    { value: 'tata', label: 'Tata', count: 6 },
  ],
  models: [],
  fuelTypes: [
    { value: 'petrol', label: 'Petrol', count: 18 },
    { value: 'cng', label: 'CNG', count: 12 },
  ],
  transmissions: [
    { value: 'manual', label: 'Manual', count: 20 },
    { value: 'automatic', label: 'Automatic', count: 19 },
  ],
  bodyTypes: [{ value: 'suv', label: 'SUV', count: 15 }],
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
  ownerCounts: [{ value: '1', label: 'First owner', count: 20 }],
  dealers: [{ value: 'arcot-city-cars', label: 'Arcot City Cars', count: 5 }],
  years: [{ value: '2023', label: '2023', count: 9 }],
  price: PRICE_PRESETS.map((preset, index) => ({
    ...preset,
    count: [12, 18, 6, 2, 1][index] ?? 0,
  })),
  kilometers: KM_PRESETS.map((preset, index) => ({
    ...preset,
    count: [2, 14, 13, 9, 1][index] ?? 0,
  })),
};

const meta = {
  title: 'Search/MobileFilterSheet',
  component: MobileFilterSheet,
  parameters: {
    layout: 'padded',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
  },
  decorators: [
    (Story) => (
      <SearchNavigationProvider>
        <Story />
      </SearchNavigationProvider>
    ),
  ],
  args: { facets: FACETS, params: { district: 'ranipet' }, basePath: '/cars', total: 39 },
} satisfies Meta<typeof MobileFilterSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const WithFiltersApplied: Story = {
  args: { params: { district: 'ranipet', fuel: 'petrol', city: 'arcot' }, total: 4 },
};

export const Portfolio: Story = {
  args: {
    facets: { ...FACETS, cities: [], dealers: [] },
    params: {},
    basePath: '/dealers/arcot-city-cars',
    groups: PORTFOLIO_FILTER_GROUPS,
    total: 5,
  },
};
