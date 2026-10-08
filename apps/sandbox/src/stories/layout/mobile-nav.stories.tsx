import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MobileNav } from '@/components/layout/mobile-nav';
import { adminNavFor } from '@/components/admin/admin-nav';
import { LANDED_NAV, TEAM_NAV_ITEM } from '@/components/dealer/console-nav/console-nav.constants';
import { SALES_NAV } from '@/features/sales/sales.constants';

const meta = {
  title: 'Layout/MobileNav',
  component: MobileNav,
  args: { items: [...LANDED_NAV, TEAM_NAV_ITEM], label: 'Dealer console', rootHref: '/dealer' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory' } },
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MobileNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dealer: Story = {};
export const Admin: Story = {
  args: {
    items: adminNavFor(['admin:access:manage', 'admin:notifications:read', 'admin:config:write']),
    label: 'Admin console',
    rootHref: '/admin',
  },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/support' } } },
};
export const RestrictedAdmin: Story = {
  args: { items: adminNavFor([]), label: 'Admin console', rootHref: '/admin' },
};
export const Sales: Story = {
  args: { items: SALES_NAV, label: 'Sales workspace', rootHref: '/sales' },
};
