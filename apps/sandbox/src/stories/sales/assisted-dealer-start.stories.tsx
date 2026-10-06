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
  },
} satisfies Meta<typeof AssistedDealerStart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsentAndOtp: Story = {
  name: 'Consent, then the dealer’s OTP',
  args: { widget: FAKE_WIDGET },
};

export const OtpUnavailable: Story = {
  name: 'OTP not configured',
  args: {
    widget: { ...FAKE_WIDGET, enabled: false, devCode: null, reason: 'NOT_CONFIGURED' },
  },
};
