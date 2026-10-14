import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PublicAnalytics } from '@/features/analytics/public-analytics';

const meta = {
  title: 'Infrastructure/PublicAnalytics',
  component: PublicAnalytics,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/' } } },
} satisfies Meta<typeof PublicAnalytics>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PublicRoute: Story = {};
export const PrivateRoute: Story = {
  parameters: { nextjs: { navigation: { pathname: '/data-rights' } } },
};
