import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GetOtpButton } from '@/components/auth/get-otp-button';

const meta = {
  title: 'Auth/GetOtpButton',
  component: GetOtpButton,
  parameters: { layout: 'padded' },
  argTypes: { channel: { control: 'inline-radio', options: ['sms', 'whatsapp'] } },
  args: { channel: 'whatsapp', loading: false },
  decorators: [
    (Story) => (
      <div className="max-w-[360px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GetOtpButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhatsApp: Story = {};

export const Sms: Story = { args: { channel: 'sms' } };

export const Sending: Story = { args: { loading: true } };
