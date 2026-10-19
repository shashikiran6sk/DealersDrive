import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DistrictScopedLink } from '@/components/layout/district-scoped-link';

const meta = {
  title: 'Layout/DistrictScopedLink',
  component: DistrictScopedLink,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  args: { href: '/dealers', className: 'relative dd-chip', children: 'Browse dealers' },
} satisfies Meta<typeof DistrictScopedLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoDistrict: Story = {};

export const DistrictChosen: Story = {
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { query: { district: 'vellore' } } },
  },
};

export const CarsInDistrict: Story = {
  args: { href: '/cars', children: 'Browse all cars' },
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { query: { district: 'ranipet' } } },
  },
};
