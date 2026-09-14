import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ADMIN_NAV, AdminNav, LANDED_ADMIN_NAV } from '@/components/admin/admin-nav';

const meta = {
  title: 'Admin/AdminNav',
  component: AdminNav,
  args: { items: ADMIN_NAV },
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 206, padding: 18, background: 'var(--color-accent-900, #10243f)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {};

export const Listings: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/listings' } } },
};

export const Dealers: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/dealers' } } },
};

export const DealerDetail: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/dealers/3c8f2b10-2222' } },
  },
};

export const Payments: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/payments' } } },
};

export const Configuration: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/config' } } },
};

export const NothingCurrent: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/audit-logs' } } },
};

export const AsTheConsoleRendersItToday: Story = {
  args: { items: LANDED_ADMIN_NAV },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin' } } },
};
