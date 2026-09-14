import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerHeader } from '@/components/layout/customer-header';

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
  ],
  total: 30,
};

const meta = {
  title: 'Layout/CustomerHeader',
  component: CustomerHeader,
  args: { locations: LOCATIONS },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 220, background: 'var(--color-bg, #f4f5f7)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CustomerHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {};

export const BuyCars: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/cars' } } },
};

export const Dealers: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealers' } } },
};

export const DealerPortfolio: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dealers/sri-lakshmi-motors' } },
  },
};

export const SavedCars: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/saved' } } },
};

export const Mobile: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
    viewport: { defaultViewport: 'mobile' },
  },
};

export const Tablet: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
    viewport: { defaultViewport: 'tablet' },
  },
};
