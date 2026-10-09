import type { DashboardResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DashboardMetrics } from '@/components/dealer/dashboard-metrics';
const stats: DashboardResponse['stats'] = [
  {
    key: 'activeListings',
    label: 'Active listings',
    value: 12,
    valueLabel: '12',
    delta: '+2 this week',
    deltaTone: 'ok',
  },
  {
    key: 'newEnquiries',
    label: 'New enquiries',
    value: 7,
    valueLabel: '7',
    delta: '+3 vs last week',
    deltaTone: 'ok',
  },
  {
    key: 'views',
    label: 'Vehicle views',
    value: 1234,
    valueLabel: '1,234',
    delta: '+12% vs last week',
    deltaTone: 'ok',
  },
];
const listingStats: DashboardResponse['listingStats'] = [
  {
    key: 'PENDING_REVIEW',
    label: 'Pending review',
    value: 3,
    href: '/dealer/inventory?status=PENDING_REVIEW',
    tone: 'warn',
  },
];
const meta = {
  title: 'Dealer/DashboardMetrics',
  component: DashboardMetrics,
  args: { stats, listingStats },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
} satisfies Meta<typeof DashboardMetrics>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const LargeValues: Story = {
  args: {
    stats: stats.map((stat) => ({
      ...stat,
      valueLabel: '1,23,45,678',
      delta: 'Compared with the previous reporting week',
    })),
  },
};
export const Loading: Story = { args: { loading: true } };
export const Unavailable: Story = { args: { stats: [], listingStats: [] } };
