import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentsReminder } from '@/features/dealer/documents-overview';

const meta = {
  title: 'Dealer/DocumentsReminder',
  component: DocumentsReminder,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: {
    gaps: {
      control: 'check',
      options: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY', 'GST_CERTIFICATE'],
      description: 'The categories still to be verified. Nothing outstanding renders nothing.',
    },
  },
  args: { gaps: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'] },
} satisfies Meta<typeof DocumentsReminder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothOutstanding: Story = {};

export const OneOutstanding: Story = { args: { gaps: ['BUSINESS_IDENTITY'] } };

export const NothingOutstanding: Story = { args: { gaps: [] } };
