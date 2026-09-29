import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DiscoveryRow } from '@/features/home/discovery-row';

function car(index: number): VehicleCardDto {
  return {
    slug: `2022-hyundai-creta-${String(index)}`,
    availability: 'AVAILABLE',
    title: `2022 Hyundai Creta SX ${String(index)}`,
    year: 2022,
    priceLabel: '₹12,40,000',
    metaLabel: '31,000 km · Petrol · Automatic · Katpadi',
    image: null,
    imageCount: 0,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
  };
}

const meta = {
  title: 'Home/DiscoveryRow',
  component: DiscoveryRow,
  parameters: { layout: 'padded' },
  args: {
    id: 'home-suv',
    title: 'SUVs',
    href: '/cars?bodyType=suv',
    cars: [1, 2, 3, 4].map(car),
  },
} satisfies Meta<typeof DiscoveryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FourCars: Story = {};

export const FewerThanFour: Story = { args: { cars: [car(1), car(2)] } };

export const EmptyRendersNothing: Story = { args: { cars: [] } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
