import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ConsoleNav, ConsoleTabBar, DEALER_NAV, LANDED_NAV } from '@/components/dealer/console-nav';

const meta = {
  title: 'Dealer/ConsoleNav',
  component: ConsoleNav,
  args: { items: DEALER_NAV },
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 214, padding: 12, background: '#fff' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsoleNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};

export const Inventory: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory' } } },
};

export const EditingAVehicle: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory/3c8f2b10-2222' } },
  },
};

export const Billing: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer/billing' } } },
};

export const Profile: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer/profile' } } },
};

export const NothingCurrent: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/saved-searches' } },
  },
};

export const AsTheConsoleRendersItToday: Story = {
  args: { items: LANDED_NAV },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } } },
};

export const TabBar: StoryObj<typeof ConsoleTabBar> = {
  render: () => <ConsoleTabBar items={DEALER_NAV} />,
  args: { items: DEALER_NAV },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory' } },
  },
  decorators: [(Story) => <Story />],
};

export const TabBarAsTheConsoleRendersItToday: StoryObj<typeof ConsoleTabBar> = {
  render: () => <ConsoleTabBar items={LANDED_NAV} />,
  args: { items: LANDED_NAV },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [(Story) => <Story />],
};

export const TabBarWithNothingLanded: StoryObj<typeof ConsoleTabBar> = {
  render: () => (
    <div style={{ padding: 18, fontSize: 13, color: '#6b7280' }}>
      <ConsoleTabBar items={[]} />
      Nothing renders: an empty 56px strip pinned over every screen is a reconstruction artefact
      rather than a state of the product.
    </div>
  ),
  args: { items: [] },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [(Story) => <Story />],
};
