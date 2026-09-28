import type { SavedVehiclesResponse, VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SavedVehiclesProvider } from '@/features/saved';
import { SavedList } from '@/features/saved/saved-list';

function car(slug: string, availability: VehicleCardDto['availability']): VehicleCardDto {
  return {
    slug,
    availability,
    title: `2021 Maruti Suzuki Swift ${slug}`,
    year: 2021,
    priceLabel: '₹6,10,000',
    metaLabel: '41,000 km · Petrol · Manual · Arcot',
    image: null,
    imageCount: 0,
    dealer: { name: 'Arcot Car Point', slug: 'arcot', initials: 'AC', isVerified: true },
  };
}

function saved(cars: VehicleCardDto[], nextCursor: string | null = null): SavedVehiclesResponse {
  return {
    data: cars.map((vehicle) => ({ savedAt: '2026-09-20T10:00:00.000Z', vehicle })),
    page: { nextCursor, hasMore: nextCursor !== null },
  };
}

const EVERY_SLUG = ['vxi', 'zxi', 'lxi', 'vdi', 'zdi'];

function everySaved() {
  return Promise.resolve({ status: 'customer' as const, slugs: EVERY_SLUG });
}

const meta = {
  title: 'Vehicle/SavedList',
  component: SavedList,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <SavedVehiclesProvider loadSlugs={everySaved}>
        <Story />
      </SavedVehiclesProvider>
    ),
  ],
  args: {
    saved: saved([
      car('vxi', 'AVAILABLE'),
      car('zxi', 'AVAILABLE'),
      car('lxi', 'RESERVED'),
      car('vdi', 'SOLD'),
      car('zdi', 'UNAVAILABLE'),
    ]),
  },
} satisfies Meta<typeof SavedList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {};

export const OnlyAvailable: Story = { args: { saved: saved([car('vxi', 'AVAILABLE')]) } };

export const Empty: Story = { args: { saved: saved([]) } };

export const MorePages: Story = { args: { saved: saved([car('vxi', 'AVAILABLE')], 'next') } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
