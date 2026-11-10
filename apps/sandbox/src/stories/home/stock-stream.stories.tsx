import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StockStream } from '@/features/home/stock-stream';

const MODELS = ['Maruti Suzuki Ritz VDI', 'Hyundai Creta', 'Hyundai Xcent', 'Renault Duster'];

function car(index: number): VehicleCardDto {
  return {
    slug: `car-${String(index)}`,
    availability: 'AVAILABLE',
    title: `2016 ${MODELS[index % MODELS.length] ?? 'Hyundai i10'}`,
    year: 2016,
    priceLabel: '₹5,15,000',
    negotiability: 'SLIGHTLY',
    metaLabel: '1,00,969 km · Diesel · Automatic',
    image: null,
    imageCount: 0,
    dealer: { name: 'Thirumurugan Cars', slug: 'tc', initials: 'TC', isVerified: true },
  };
}

const meta = {
  title: 'Home/StockStream',
  component: StockStream,
  parameters: { layout: 'padded' },
  args: { cars: Array.from({ length: 10 }, (_, index) => car(index)), className: 'max-w-[640px]' },
} satisfies Meta<typeof StockStream>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TenCars: Story = {};

export const FourCars: Story = { args: { cars: [0, 1, 2, 3].map(car) } };

export const PhoneWidth: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
