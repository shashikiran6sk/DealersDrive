import type { VehicleCardDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CategoryCard, CategoryDeck, type HomeCategoryView } from '@/features/home/category-deck';
import { HOME_CATEGORIES } from '@/features/home/home.constants';
import { categoryHref } from '@/features/home/utils';

function car(index: number): VehicleCardDto {
  return {
    slug: `2016-hyundai-creta-${String(index)}`,
    availability: 'AVAILABLE',
    title: `2016 Hyundai Creta ${String(index)}`,
    year: 2016,
    priceLabel: '₹7,25,000',
    negotiability: 'SLIGHTLY',
    metaLabel: '1,05,384 km · Diesel · Manual · Vellore',
    image: null,
    imageCount: 0,
    dealer: { name: 'Thirumurugan Cars', slug: 'tc', initials: 'TC', isVerified: true },
  };
}

const CATEGORIES: HomeCategoryView[] = HOME_CATEGORIES.map((category) => ({
  ...category,
  href: categoryHref(category),
  cars: category.key === 'family' ? [] : [1, 2, 3].map(car),
}));

function card(index: number): HomeCategoryView {
  const category = CATEGORIES[index];
  if (!category) throw new Error(`No category at ${String(index)}`);
  return category;
}

const meta = {
  title: 'Home/CategoryDeck',
  component: CategoryDeck,
  parameters: { layout: 'fullscreen' },
  args: { categories: CATEGORIES },
} satisfies Meta<typeof CategoryDeck>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveCategories: Story = {};

export const PhoneWidth: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };

export const OneCard: Story = {
  parameters: { layout: 'padded' },
  render: () => <CategoryCard category={card(0)} position={0} total={5} />,
};

export const EmptyCategory: Story = {
  parameters: { layout: 'padded' },
  render: () => <CategoryCard category={card(3)} position={3} total={5} />,
};

export const Featured: Story = {
  parameters: { layout: 'padded' },
  render: () => <CategoryCard category={card(4)} position={4} total={5} />,
};
