import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { HOME_BRANDS } from '../../mocks/home-actions';

import { HeroSearch } from '@/features/home/hero-search';

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'ranipet', name: 'Ranipet', count: 4, state: 'Tamil Nadu' },
    { slug: 'vellore', name: 'Vellore', count: 6, state: 'Tamil Nadu' },
    { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 9, state: 'Karnataka' },
  ],
  total: 19,
  cars: { total: 64, districts: { ranipet: 12, vellore: 18, 'bengaluru-urban': 34 } },
};

const meta = {
  title: 'Home/HeroSearch',
  component: HeroSearch,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  args: { locations: LOCATIONS, brands: HOME_BRANDS },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeroSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoInventoryYet: Story = { args: { brands: [] } };

export const Mobile: Story = {
  parameters: { nextjs: { appDirectory: true }, viewport: { defaultViewport: 'mobile1' } },
};
