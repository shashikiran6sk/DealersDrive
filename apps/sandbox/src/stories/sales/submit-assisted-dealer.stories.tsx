import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SubmitAssistedDealer } from '@/features/sales/submit-assisted-dealer';

const meta = {
  title: 'Sales/SubmitAssistedDealer',
  component: SubmitAssistedDealer,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[640px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { dealerId: 'd-1', canSubmit: true, missing: [] },
  argTypes: {
    canSubmit: { control: 'boolean' },
    missing: { control: 'object', description: 'Completeness items still outstanding.' },
  },
} satisfies Meta<typeof SubmitAssistedDealer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Incomplete: Story = {
  args: { canSubmit: false, missing: ['Documents', 'Yard photo'] },
};
