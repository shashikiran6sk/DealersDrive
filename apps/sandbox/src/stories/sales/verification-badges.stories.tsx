import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VerificationBadges } from '@/features/sales/verification-badges';

const meta = {
  title: 'Sales/VerificationBadges',
  component: VerificationBadges,
  decorators: [
    (Story) => (
      <div className="p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { dealer: { phoneVerified: true, emailVerified: false, claimed: false } },
  argTypes: { dealer: { control: 'object' } },
} satisfies Meta<typeof VerificationBadges>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmailPending: Story = { name: 'Phone verified, email pending' };

export const Claimed: Story = {
  name: 'Verified and claimed',
  args: { dealer: { phoneVerified: true, emailVerified: true, claimed: true } },
};

export const Unverified: Story = {
  args: { dealer: { phoneVerified: false, emailVerified: false, claimed: false } },
};
