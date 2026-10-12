import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ManualActivationNotice } from '@/features/admin/manual-activation-notice';

import { MANUAL_ACTIVATION, STANDARD_ACTIVATION } from '../../mocks/admin-dealer';

const meta = {
  title: 'Admin/ManualActivationNotice',
  component: ManualActivationNotice,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[720px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { activation: MANUAL_ACTIVATION },
  argTypes: { activation: { control: 'object' } },
} satisfies Meta<typeof ManualActivationNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManuallyActivated: Story = { name: 'Manually activated, one category outstanding' };

export const BothCategoriesOutstanding: Story = {
  args: {
    activation: {
      ...MANUAL_ACTIVATION,
      outstanding: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
    },
  },
};

export const RecorderUnknown: Story = {
  args: { activation: { ...MANUAL_ACTIVATION, overriddenBy: null } },
};

export const StandardApproval: Story = {
  name: 'Standard approval — renders nothing',
  args: { activation: STANDARD_ACTIVATION },
};
