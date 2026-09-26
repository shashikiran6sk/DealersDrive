import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ListingStats } from '@/components/dealer/listing-stats';

const meta = {
  title: 'Dealer/ListingStats',
  component: ListingStats,
  parameters: { layout: 'padded' },
  args: {
    stats: [
      { key: 'ACTIVE', label: 'Active listings', value: 7, href: '#', tone: 'ok' },
      { key: 'PENDING_REVIEW', label: 'Pending review', value: 2, href: '#', tone: 'warn' },
      { key: 'CHANGES_REQUESTED', label: 'Changes requested', value: 1, href: '#', tone: 'warn' },
      { key: 'SOLD', label: 'Sold', value: 14, href: '#', tone: 'accent' },
    ],
  },
} satisfies Meta<typeof ListingStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const NewDealership: Story = {
  args: {
    stats: [
      { key: 'ACTIVE', label: 'Active listings', value: 0, href: '#', tone: 'ok' },
      { key: 'PENDING_REVIEW', label: 'Pending review', value: 0, href: '#', tone: 'warn' },
      { key: 'CHANGES_REQUESTED', label: 'Changes requested', value: 0, href: '#', tone: 'warn' },
      { key: 'SOLD', label: 'Sold', value: 0, href: '#', tone: 'accent' },
    ],
  },
};
