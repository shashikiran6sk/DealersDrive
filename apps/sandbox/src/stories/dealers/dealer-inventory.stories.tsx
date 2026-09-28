import {
  KM_PRESETS,
  NO_VEHICLE_FACETS,
  PRICE_PRESETS,
  type PublicVehiclesResponse,
  type VehicleCardDto,
} from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerInventory } from '@/components/dealers/dealer-inventory';

const SHADES = ['1f2937', '374151', '4b5563', '0f172a', '1e293b', '334155'];

function car(index: number): VehicleCardDto {
  return {
    slug: `car-${index}`,
    availability: index === 1 ? 'RESERVED' : 'AVAILABLE',
    title:
      ['2023 Hyundai Creta SX(O)', '2021 Tata Nexon XZ+', '2019 Maruti Suzuki Swift VXi'][
        index % 3
      ] ?? '2023 Hyundai Creta SX(O)',
    year: 2023 - (index % 4),
    priceLabel: index % 5 === 4 ? null : '₹14,50,000',
    metaLabel: '22,400 km · Petrol · Automatic · Katpadi',
    image:
      index % 4 === 3
        ? null
        : {
            url: `https://placehold.co/1200x900/${SHADES[index % SHADES.length] ?? '1f2937'}/e5e7eb.png?text=Car+${index + 1}`,
            alt: `Car ${index + 1}`,
          },
    imageCount: 8,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
  };
}

function inventory(count: number, total = count, page = 1): PublicVehiclesResponse {
  return {
    data: Array.from({ length: count }, (_, index) => car(index)),
    page: { page, limit: 24, total, totalPages: Math.max(1, Math.ceil(total / 24)) },
    available: count > 1 ? total - 1 : total,
    facets: NO_VEHICLE_FACETS,
  };
}

const meta = {
  title: 'Dealers/DealerInventory',
  component: DealerInventory,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  args: {
    dealerSlug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    inventory: inventory(6),
  },
} satisfies Meta<typeof DealerInventory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const OneCar: Story = { args: { inventory: inventory(1) } };

export const NothingAvailable: Story = { args: { inventory: inventory(0) } };

export const Paged: Story = { args: { inventory: inventory(24, 30) } };

const PORTFOLIO_FACETS = {
  ...NO_VEHICLE_FACETS,
  brands: [
    { value: 'hyundai', label: 'Hyundai', count: 4 },
    { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 3 },
  ],
  fuelTypes: [
    { value: 'petrol', label: 'Petrol', count: 5 },
    { value: 'cng', label: 'CNG', count: 2 },
  ],
  price: PRICE_PRESETS.map((preset, index) => ({ ...preset, count: [2, 4, 1, 0, 0][index] ?? 0 })),
  kilometers: KM_PRESETS.map((preset, index) => ({
    ...preset,
    count: [1, 3, 2, 1, 0][index] ?? 0,
  })),
};

export const Filtered: Story = {
  args: {
    inventory: { ...inventory(2), facets: PORTFOLIO_FACETS },
    params: { fuel: 'cng' },
    liveTotal: 7,
    location: 'Arcot, Ranipet, Tamil Nadu',
  },
};

export const NoMatch: Story = {
  args: {
    inventory: { ...inventory(0), facets: PORTFOLIO_FACETS },
    params: { fuel: 'cng', brand: 'hyundai' },
    liveTotal: 7,
    location: 'Arcot, Ranipet, Tamil Nadu',
  },
};
