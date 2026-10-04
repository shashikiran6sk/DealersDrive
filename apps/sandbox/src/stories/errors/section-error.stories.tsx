import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RetryButton } from '@/components/errors/retry-button';
import { SectionError } from '@/components/errors/section-error';

const meta = {
  title: 'Errors/SectionError',
  component: SectionError,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  args: {
    title: 'We couldn’t load these vehicles right now',
    message: 'Please try again, or browse every car on the marketplace.',
  },
} satisfies Meta<typeof SectionError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HomepageRows: Story = {};

export const DealerInventory: Story = {
  args: {
    title: 'We couldn’t load this dealership’s cars right now',
    message: 'The dealership’s details are above. Please try again for its cars.',
  },
};

export const RetryOnly: Story = { render: () => <RetryButton /> };
