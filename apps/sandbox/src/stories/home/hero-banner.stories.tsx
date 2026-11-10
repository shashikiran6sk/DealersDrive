import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { HeroBanner, HOME_HERO_IMAGE } from '@/features/home/hero-banner';
import { StockStream } from '@/features/home/stock-stream';

const COPY = (
  <>
    <div className="eyebrow mb-4">Independent dealers · one trusted platform</div>
    <h1 className="text-[56px] leading-none tracking-[-0.05em]">Find your next car</h1>
    <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.75] ink-secondary">
      Used cars from independent dealerships across Tamil Nadu. Reviewed before they go live, priced
      by the dealer.
    </p>
  </>
);

function car(index: number): VehicleCardDto {
  return {
    slug: `car-${String(index)}`,
    availability: 'AVAILABLE',
    title: `2017 Honda BR-V ${String(index)}`,
    year: 2017,
    priceLabel: '₹7,50,000',
    negotiability: null,
    metaLabel: '1,23,475 km · Diesel · Manual',
    image: null,
    imageCount: 0,
    dealer: { name: 'Thirumurugan Cars', slug: 'tc', initials: 'TC', isVerified: true },
  };
}

const meta = {
  title: 'Home/HeroBanner',
  component: HeroBanner,
  parameters: { layout: 'fullscreen' },
  args: { image: HOME_HERO_IMAGE, children: COPY },
  argTypes: { image: { control: 'object' } },
} satisfies Meta<typeof HeroBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithStream: Story = {
  args: { aside: <StockStream cars={Array.from({ length: 8 }, (_, index) => car(index))} /> },
};

export const WithPhotograph: Story = {};

export const NoPhotograph: Story = { args: { image: null } };

export const PhoneWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};
