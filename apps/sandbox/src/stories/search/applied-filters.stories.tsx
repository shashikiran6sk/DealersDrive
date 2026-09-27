import { KM_PRESETS, NO_VEHICLE_FACETS, PRICE_PRESETS } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppliedFilters } from '@/components/search/applied-filters';

const meta = {
  title: 'Search/AppliedFilters',
  component: AppliedFilters,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
  },
  args: {
    facets: {
      ...NO_VEHICLE_FACETS,
      cities: [{ value: 'arcot', label: 'Arcot', count: 11 }],
      brands: [{ value: 'hyundai', label: 'Hyundai', count: 6 }],
      fuelTypes: [{ value: 'petrol', label: 'Petrol', count: 18 }],
      price: PRICE_PRESETS.map((preset) => ({ ...preset, count: 3 })),
      kilometers: KM_PRESETS.map((preset) => ({ ...preset, count: 3 })),
    },
    params: { district: 'ranipet' },
    basePath: '/cars',
  },
} satisfies Meta<typeof AppliedFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingApplied: Story = {};

export const AFewFilters: Story = {
  args: { params: { district: 'ranipet', city: 'arcot', brand: 'hyundai', fuel: 'petrol' } },
};

export const RangesAndSearch: Story = {
  args: {
    params: {
      q: 'creta',
      minPrice: '50000000',
      maxPrice: '100000000',
      minYear: '2020',
      minKm: '5000',
      maxKm: '25000',
    },
  },
};
