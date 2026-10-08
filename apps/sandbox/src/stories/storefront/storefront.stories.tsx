import { StorefrontHome, StorefrontShell } from '@dealers-drive/storefront-ui';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { INVENTORY, SITE } from '../../../../../packages/storefront-ui/tests/fixtures.js';
import '@dealers-drive/storefront-ui/styles.css';

const meta = {
  title: 'Storefront/DealerWebsite',
  component: StorefrontShell,
  parameters: { layout: 'fullscreen' },
  args: { site: SITE, children: null, preview: false },
  render: (args) => (
    <StorefrontShell {...args}>
      <StorefrontHome site={args.site} inventory={INVENTORY} />
    </StorefrontShell>
  ),
} satisfies Meta<typeof StorefrontShell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { site: { ...SITE, theme: 'DARK' } } };
export const Empty: Story = {
  render: (args) => (
    <StorefrontShell {...args}>
      <StorefrontHome
        site={args.site}
        inventory={{
          ...INVENTORY,
          data: [],
          page: { page: 1, limit: 24, total: 0, totalPages: 1 },
        }}
      />
    </StorefrontShell>
  ),
};
export const PrivatePreview: Story = { args: { preview: true } };
export const MissingPhotography: Story = {
  args: { site: { ...SITE, heroUrl: null, yardUrls: [] } },
  render: (args) => (
    <StorefrontShell {...args}>
      <StorefrontHome
        site={args.site}
        inventory={{ ...INVENTORY, data: INVENTORY.data.map((car) => ({ ...car, image: null })) }}
      />
    </StorefrontShell>
  ),
};
export const LongBusinessName: Story = {
  args: {
    site: {
      ...SITE,
      name: 'Alpha Motors and Automotive Services of Vellore',
      headline: 'Discover a car for every chapter of your next journey',
    },
  },
};
