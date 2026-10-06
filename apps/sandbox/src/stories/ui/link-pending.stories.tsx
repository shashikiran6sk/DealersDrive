import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Link from 'next/link';

import { ButtonLink, Spinner } from '@/components/ui/button';
import { LinkPendingIndicator } from '@/components/ui/link-pending';

const meta = {
  title: 'Primitives/LinkPending',
  component: LinkPendingIndicator,
  args: { reserve: true },
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ width: 214, padding: 12, background: '#fff' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LinkPendingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdleNavItem: Story = {
  render: (args) => (
    <Link href="/dealer/inventory" className="dd-nav-item">
      <span className="min-w-0 flex-1 truncate">Inventory</span>
      <LinkPendingIndicator {...args} />
    </Link>
  ),
};

export const PendingNavItem: Story = {
  name: 'Pending nav item (appearance)',
  render: () => (
    <span className="dd-nav-item" aria-current="true">
      <span className="min-w-0 flex-1 truncate">Inventory</span>
      <span className="inline-flex size-[14px] flex-none items-center justify-center">
        <Spinner />
      </span>
    </span>
  ),
};

export const PendingCard: Story = {
  name: 'Pending card (appearance)',
  render: () => (
    <div className="relative h-[120px] w-[200px] rounded-[15px] bg-(--color-neutral-150)">
      <span className="absolute top-[10px] left-1/2 inline-flex size-[28px] -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-sm">
        <Spinner />
      </span>
    </div>
  ),
};

export const IdleButtonLink: Story = {
  render: () => (
    <ButtonLink href="/cars" variant="primary">
      View all →
    </ButtonLink>
  ),
};

export const PendingButtonLink: Story = {
  name: 'Pending button link (appearance)',
  render: () => (
    <span className="btn btn-primary relative">
      <span className="invisible contents">View all →</span>
      <span className="absolute inset-0 grid place-items-center">
        <Spinner />
      </span>
    </span>
  ),
};
