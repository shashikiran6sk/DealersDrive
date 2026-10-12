import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AssistedDealerStart } from '@/features/sales/assisted-dealer-start';

const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

const meta = {
  title: 'Sales/AssistedDealerStart',
  component: AssistedDealerStart,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[640px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    widget: {
      control: false,
      description: 'GET /v1/sales/phone/widget — null when OTP is not configured (**R112**).',
    },
    initialVerified: {
      control: false,
      description: 'Sandbox entry point: both codes already accepted, tickets in hand (#299).',
    },
  },
} satisfies Meta<typeof AssistedDealerStart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsentAndOtp: Story = {
  name: 'Consent, the dealer’s OTP, then the email code',
  args: { widget: FAKE_WIDGET },
};

export const BothVerified: Story = {
  name: 'Mobile and email verified — continue',
  args: {
    widget: FAKE_WIDGET,
    initialVerified: {
      phone: '9840012345',
      phoneTicket: 'sandbox-ticket',
      email: 'selvi@gmail.com',
      emailTicket: 'sandbox-email-ticket',
    },
  },
};

export const OtpUnavailable: Story = {
  name: 'OTP not configured',
  args: {
    widget: { ...FAKE_WIDGET, enabled: false, devCode: null, reason: 'NOT_CONFIGURED' },
  },
};
