import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SimilarVehicles } from '@/components/vehicle/similar-vehicles';

function car(index: number, dealer: string): VehicleCardDto {
  return {
    slug: `2022-kia-seltos-${String(index)}`,
    availability: 'AVAILABLE',
    title: `2022 Kia Seltos HTX ${String(index)}`,
    year: 2022,
    priceLabel: '₹13,20,000',
    metaLabel: '28,000 km · Petrol · Manual · Arcot',
    image: null,
    imageCount: 0,
    dealer: { name: dealer, slug: 'dealer', initials: 'AC', isVerified: true },
  };
}

const meta = {
  title: 'Vehicle/SimilarVehicles',
  component: SimilarVehicles,
  parameters: { layout: 'padded' },
  args: {
    vehicles: [
      car(1, 'Arcot Car Point'),
      car(2, 'Sri Lakshmi Motors'),
      car(3, 'Vellore Wheels'),
      car(4, 'Ranipet Autos'),
    ],
  },
} satisfies Meta<typeof SimilarVehicles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Four: Story = {};

export const Two: Story = {
  args: { vehicles: [car(1, 'Arcot Car Point'), car(2, 'Ranipet Autos')] },
};

export const NoneRendersNothing: Story = { args: { vehicles: [] } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
