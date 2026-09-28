import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AvailabilityNotice } from '@/components/vehicle/availability-notice';

const meta = {
  title: 'Vehicle/AvailabilityNotice',
  component: AvailabilityNotice,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AvailabilityNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reserved: Story = {};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
