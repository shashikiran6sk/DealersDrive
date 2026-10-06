import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EmailVerificationPanel } from '@/features/sales/email-verification-panel';

const SENT = {
  email: 'selvi@gmail.com',
  sentAt: '2026-10-06T10:00:00.000Z',
  expiresAt: '2999-10-09T10:00:00.000Z',
  verifiedAt: null,
  claimedAt: null,
  canResend: true,
};

const meta = {
  title: 'Sales/EmailVerificationPanel',
  component: EmailVerificationPanel,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[640px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { dealerId: 'd-1', verification: SENT },
  argTypes: { verification: { control: 'object' } },
} satisfies Meta<typeof EmailVerificationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sent: Story = {};

export const Cooldown: Story = { args: { verification: { ...SENT, canResend: false } } };

export const Expired: Story = {
  args: { verification: { ...SENT, expiresAt: '2000-01-01T00:00:00.000Z' } },
};

export const Verified: Story = {
  args: { verification: { ...SENT, verifiedAt: '2026-10-06T11:00:00.000Z' } },
};

export const Claimed: Story = {
  args: {
    verification: {
      ...SENT,
      verifiedAt: '2026-10-06T11:00:00.000Z',
      claimedAt: '2026-10-06T11:05:00.000Z',
    },
  },
};

export const NeverSent: Story = { name: 'Nothing sent yet', args: { verification: null } };
