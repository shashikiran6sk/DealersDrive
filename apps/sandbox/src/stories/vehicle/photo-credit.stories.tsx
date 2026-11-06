import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhotoCredit } from '@/components/vehicle/photo-credit';

const meta = {
  title: 'Vehicle/PhotoCredit',
  component: PhotoCredit,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    credit: {
      control: 'select',
      options: ['DEALERS_DRIVE', 'DEALER', 'MIXED', null],
    },
  },
  args: { credit: 'DEALERS_DRIVE', dealerName: 'Sri Lakshmi Motors' },
} satisfies Meta<typeof PhotoCredit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const DealersDrive: Story = { args: { credit: 'DEALERS_DRIVE' } };

export const Dealer: Story = { args: { credit: 'DEALER' } };

export const Mixed: Story = { args: { credit: 'MIXED' } };

export const Unrecorded: Story = { args: { credit: null } };

export const PhoneWidth: Story = {
  args: { credit: 'MIXED' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
