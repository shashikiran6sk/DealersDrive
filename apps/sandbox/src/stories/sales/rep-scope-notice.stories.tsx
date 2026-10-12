import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RepScopeNotice } from '@/features/sales/rep-scope-notice';

const meta = {
  title: 'Sales/RepScopeNotice',
  component: RepScopeNotice,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[760px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { businessComplete: true },
  argTypes: {
    businessComplete: {
      control: 'boolean',
      description: 'Whether completeness reports the business step (Step 2) complete.',
    },
  },
} satisfies Meta<typeof RepScopeNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PartComplete: Story = {};

export const BusinessDetailsOutstanding: Story = { args: { businessComplete: false } };
