import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SearchNavigationProvider } from '@/components/search/search-navigation';
import { SearchToolbar } from '@/components/search/search-toolbar';

const meta = {
  title: 'Search/SearchToolbar',
  component: SearchToolbar,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
  },
  decorators: [
    (Story) => (
      <SearchNavigationProvider>
        <Story />
      </SearchNavigationProvider>
    ),
  ],
  args: { params: {}, basePath: '/cars' },
} satisfies Meta<typeof SearchToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SearchApplied: Story = { args: { params: { q: 'creta' } } };

export const PriceLowToHigh: Story = { args: { params: { sort: 'price_asc' } } };

export const KilometersLowToHigh: Story = { args: { params: { sort: 'km_asc' } } };

export const WithoutSearch: Story = { args: { showSearch: false } };
