import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerCredits } from '@/features/admin/dealer-credits';

import { MOCK_DEALER_CREDITS } from '../../mocks/photos-and-credits';

const meta = {
  title: 'Admin/DealerCredits',
  component: DealerCredits,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: { credits: { control: 'object' } },
  args: { dealerId: '11111111-1111-4111-8111-111111111111', credits: MOCK_DEALER_CREDITS },
} satisfies Meta<typeof DealerCredits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SuperAdmin: Story = {};

export const ReadOnly: Story = { args: { credits: { ...MOCK_DEALER_CREDITS, canAdjust: false } } };

export const FeatureOff: Story = {
  args: {
    credits: {
      ...MOCK_DEALER_CREDITS,
      enabled: false,
      ledger: [],
      orders: [],
      balance: 0,
      held: 0,
      available: 0,
    },
  },
};
