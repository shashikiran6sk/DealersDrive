import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { HeroBanner } from '@/features/home/hero-banner';

const COPY = (
  <>
    <div className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/80">
      Independent dealers · one trusted platform
    </div>
    <h1 className="text-[48px] leading-[1.05] tracking-[-0.04em] text-white">Find your next car</h1>
    <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.8] text-white/85">
      Used cars from verified independent dealerships, photographed by Dealers-Drive and reviewed
      before they go live.
    </p>
  </>
);

const meta = {
  title: 'Home/HeroBanner',
  component: HeroBanner,
  parameters: { layout: 'fullscreen' },
  args: { image: null, children: COPY },
  argTypes: { image: { control: 'object' } },
} satisfies Meta<typeof HeroBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoPhotograph: Story = {};

export const WithPhotograph: Story = {
  args: {
    image: {
      src: 'https://images.example.com/dealership-yard.jpg',
      alt: 'A dealer with customers in a used-car yard',
    },
  },
};

export const PhoneWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};
