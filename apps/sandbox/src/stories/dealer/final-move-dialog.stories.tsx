import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { FinalMoveDialog } from '@/features/dealer/enquiries';

const meta = {
  title: 'Dealer/FinalMoveDialog',
  component: FinalMoveDialog,
  argTypes: {
    to: { control: 'inline-radio', options: ['CLOSED', 'SPAM'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  args: {
    to: 'CLOSED',
    label: 'Close',
    customerName: 'Ravi Kumar',
    disabled: false,
    loading: false,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof FinalMoveDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Close: Story = {};

export const Spam: Story = { args: { to: 'SPAM', label: 'Spam' } };

export const Moving: Story = { args: { loading: true } };
