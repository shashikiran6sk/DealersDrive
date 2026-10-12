import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VerifyOwnerPanel } from '@/features/sales/verify-owner-panel';

const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

const meta = {
  title: 'Sales/VerifyOwnerPanel',
  component: VerifyOwnerPanel,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[640px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: {
    dealerId: 'd-1',
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
    widget: FAKE_WIDGET,
  },
  argTypes: {
    dealerId: { control: false },
    phone: { control: false, description: 'The dealership’s own number, E.164 — fixed.' },
    phoneDisplay: { control: 'text' },
    widget: {
      control: false,
      description: 'GET /v1/sales/phone/widget — null when OTP is not configured.',
    },
  },
} satisfies Meta<typeof VerifyOwnerPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VerifyNow: Story = { name: 'Verify now — mobile, email, then link' };

export const OtpUnavailable: Story = {
  name: 'OTP not configured',
  args: { widget: { ...FAKE_WIDGET, enabled: false, devCode: null, reason: 'NOT_CONFIGURED' } },
};
