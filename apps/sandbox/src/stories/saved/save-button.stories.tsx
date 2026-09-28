import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { savedActionStub } from '../../mocks/saved-actions';

import { SaveButton } from '@/components/vehicle/save-button';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { SavedVehiclesProvider } from '@/features/saved';

const CARD: VehicleCardDto = {
  slug: 'a-car',
  availability: 'AVAILABLE',
  title: '2022 Hyundai Creta SX',
  year: 2022,
  priceLabel: '₹12,40,000',
  metaLabel: '31,000 km · Petrol · Automatic · Katpadi',
  image: null,
  imageCount: 0,
  dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
};

const meta = {
  title: 'Vehicle/SaveButton',
  component: SaveButton,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: { variant: { control: 'inline-radio', options: ['overlay', 'labelled'] } },
  args: { slug: 'a-car', title: CARD.title, variant: 'overlay' },
  decorators: [
    (Story) => (
      <SavedVehiclesProvider>
        <Story />
      </SavedVehiclesProvider>
    ),
  ],
  beforeEach: () => {
    savedActionStub.account = { status: 'customer', slugs: ['saved-car'] };
    savedActionStub.result = null;
  },
} satisfies Meta<typeof SaveButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotSaved: Story = {};

export const Saved: Story = { args: { slug: 'saved-car' } };

export const Labelled: Story = { args: { variant: 'labelled' } };

export const LabelledSaved: Story = { args: { variant: 'labelled', slug: 'saved-car' } };

export const Refused: Story = {
  beforeEach: () => {
    savedActionStub.result = {
      status: 'refused',
      message: 'This car is no longer on the marketplace, so it cannot be saved.',
    };
  },
};

export const OnCards: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 262px)' }}>
      <VehicleCard vehicle={CARD} />
      <VehicleCard vehicle={{ ...CARD, slug: 'saved-car' }} />
      <VehicleCard vehicle={{ ...CARD, slug: 'held', availability: 'RESERVED' }} />
    </div>
  ),
};
