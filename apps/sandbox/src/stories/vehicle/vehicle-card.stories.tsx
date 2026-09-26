import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle/vehicle-card';

const CARD: VehicleCardDto = {
  slug: '2023-hyundai-creta-sx-o-katpadi-3f9a1c2b',
  title: '2023 Hyundai Creta SX(O)',
  year: 2023,
  priceLabel: '₹14,50,000',
  metaLabel: '22,400 km · Petrol · Automatic · Katpadi',
  image: {
    url: 'https://placehold.co/1200x900/1f2937/e5e7eb.png?text=Creta',
    alt: '2023 Hyundai Creta SX(O), the primary photograph',
  },
  imageCount: 8,
  dealer: {
    name: 'Sri Lakshmi Motors',
    slug: 'sri-lakshmi-motors-katpadi',
    initials: 'SL',
    isVerified: true,
  },
};

const meta = {
  title: 'Vehicle/VehicleCard',
  component: VehicleCard,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { vehicle: { control: 'object' }, priority: { control: 'boolean' } },
  args: { vehicle: CARD },
} satisfies Meta<typeof VehicleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithoutPhotograph: Story = { args: { vehicle: { ...CARD, image: null } } };

export const PriceOnRequest: Story = { args: { vehicle: { ...CARD, priceLabel: null } } };

export const LongTitle: Story = {
  args: {
    vehicle: {
      ...CARD,
      title: '2019 Mahindra Scorpio S11 7-Seater 2WD BS-IV Diesel Manual Special Edition',
      dealer: { ...CARD.dealer, name: 'Sri Venkateswara Premium Pre-Owned Cars and Services' },
    },
  },
};

export const UnverifiedDealer: Story = {
  args: { vehicle: { ...CARD, dealer: { ...CARD.dealer, isVerified: false } } },
};

export const Skeleton: Story = { render: () => <VehicleCardSkeleton /> };

export const Grid: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1100, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fill,minmax(258px,1fr))',
      }}
    >
      <VehicleCard vehicle={CARD} priority />
      <VehicleCard vehicle={{ ...CARD, slug: 'b', image: null, year: 2021 }} />
      <VehicleCard vehicle={{ ...CARD, slug: 'c', priceLabel: null }} />
      <VehicleCardSkeleton />
    </div>
  ),
};
