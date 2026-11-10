import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CategoryIcon } from '@/features/home/category-deck';
import { CategoryShortcuts } from '@/features/home/category-shortcuts';
import { HOME_CATEGORIES, type HomeCategoryIcon } from '@/features/home/home.constants';
import { categoryHref } from '@/features/home/utils';

const SHORTCUTS = HOME_CATEGORIES.map((category) => ({
  ...category,
  href: categoryHref(category),
}));

const ICONS: HomeCategoryIcon[] = ['suv', 'automatic', 'price', 'family', 'odometer'];

const meta = {
  title: 'Home/CategoryShortcuts',
  component: CategoryShortcuts,
  parameters: { layout: 'padded' },
  args: { categories: SHORTCUTS },
} satisfies Meta<typeof CategoryShortcuts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PhoneWidth: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };

export const Icons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {ICONS.map((icon) => (
        <CategoryIcon key={icon} icon={icon} className="h-[48px] w-[96px]" />
      ))}
    </div>
  ),
};
