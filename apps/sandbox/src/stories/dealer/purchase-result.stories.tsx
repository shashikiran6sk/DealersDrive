import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { PurchaseResult } from '@/features/dealer/billing';

const meta = {
  title: 'Dealer/PurchaseResult',
  component: PurchaseResult,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: {
    outcome: { control: 'object' },
    offerAddVehicle: { control: 'boolean' },
  },
  args: {
    outcome: {
      kind: 'paid',
      credits: 5,
      available: 9,
      amountLabel: '₹2,250',
      paymentId: 'pay_PxK9AbCdEfGhIj',
    },
    offerAddVehicle: true,
    onClose: fn(),
    onRetry: fn(),
    returnFocus: fn(),
  },
} satisfies Meta<typeof PurchaseResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = {};

export const PaidInSubmitChecklist: Story = { args: { offerAddVehicle: false } };

export const Pending: Story = {
  args: { outcome: { kind: 'pending', amountLabel: '₹500', paymentId: 'pay_PxK9AbCdEfGhIj' } },
};

export const Unconfirmed: Story = {
  args: {
    outcome: {
      kind: 'unconfirmed',
      message:
        'We could not confirm that payment with Razorpay. If money left your account, it will be credited or refunded automatically — contact support with the payment id.',
      paymentId: 'pay_PxK9AbCdEfGhIj',
    },
  },
};

export const NotCompleted: Story = { args: { outcome: { kind: 'failed', packId: '5' } } };
