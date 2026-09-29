import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VdpDealerCard } from '@/components/vehicle/vdp-dealer-card';

const DEALER = {
  name: 'Sri Lakshmi Motors',
  slug: 'sri-lakshmi-motors-katpadi',
  initials: 'SL',
  isVerified: true,
  location: 'Katpadi, Vellore',
  city: 'Katpadi',
  district: 'Vellore',
  state: 'Tamil Nadu',
};

const meta = {
  title: 'Vehicle/VdpDealerCard',
  component: VdpDealerCard,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  args: { dealer: DEALER },
} satisfies Meta<typeof VdpDealerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const LongName: Story = {
  args: {
    dealer: { ...DEALER, name: 'Sri Venkateswara Premium Pre-Owned Cars and Services' },
  },
};

export const NoLocation: Story = {
  args: { dealer: { ...DEALER, location: null, city: null, district: null, state: null } },
};
