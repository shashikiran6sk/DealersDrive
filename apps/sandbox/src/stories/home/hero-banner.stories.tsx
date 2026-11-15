import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test';

import { HeroBanner, HOME_HERO_IMAGE } from '@/features/home/hero-banner';
import { HeroKeys } from '@/features/home/hero-keys';
import { StockStream } from '@/features/home/stock-stream';
import { CarSearchBox } from '@/components/search/car-search-box';
import { CategoryShortcuts } from '@/features/home/category-shortcuts';
import { HOME_CATEGORIES } from '@/features/home/home.constants';
import { categoryHref } from '@/features/home/utils';

const COPY = (
  <>
    <div className="eyebrow mb-4">Independent dealers · one trusted platform</div>
    <h1 className="text-[56px] leading-none tracking-[-0.05em]">Find your perfect car</h1>
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

export const WithSearchAndShortcuts: Story = {
  parameters: { nextjs: { appDirectory: true } },
  args: {
    children: (
      <>
        {COPY}
        <div className="dd-rise relative z-10 mt-7">
          <CarSearchBox params={{}} basePath="/cars" className="sm:max-w-[560px]" />
        </div>
        <CategoryShortcuts
          categories={HOME_CATEGORIES.map((category) => ({
            ...category,
            href: categoryHref(category),
          }))}
          className="mt-5"
        />
        <HeroKeys className="mt-6 lg:mt-8" />
      </>
    ),
    aside: <StockStream cars={Array.from({ length: 8 }, (_, index) => car(index))} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fetch = spyOn(window, 'fetch').mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      const search = new URL(url, window.location.origin).searchParams.get('search') ?? '';
      return Promise.resolve(
        new Response(
          JSON.stringify({
            search,
            countLabel: '1 match',
            data: [
              {
                kind: 'BRAND',
                label: 'Hyundai',
                metaLabel: 'Brand · 12 cars',
                brand: 'hyundai',
                model: null,
                variant: null,
                count: 12,
              },
            ],
          }),
        ),
      );
    });
    try {
      const input = canvas.getByRole('combobox');
      await userEvent.type(input, 'hy');
      const option = await canvas.findByRole('option', {}, { timeout: 5000 });
      await waitFor(async () => {
        const box = option.getBoundingClientRect();
        const hit = canvasElement.ownerDocument.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        await expect(option.contains(hit)).toBe(true);
      });
      await userEvent.click(option);
      await expect(input).toHaveValue('');
      await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
    } finally {
      fetch.mockRestore();
    }
  },
};

export const NoPhotograph: Story = { args: { image: null } };

export const PhoneWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};
