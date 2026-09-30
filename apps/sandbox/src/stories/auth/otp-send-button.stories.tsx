import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { OtpSendButton } from '@/components/auth/otp-send-button';

const meta = {
  title: 'Forms/OtpSendButton',
  component: OtpSendButton,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, margin: '32px auto', background: '#fff', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    whatsapp: { control: 'boolean' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'Send OTP', whatsapp: true, loading: false, disabled: false },
} satisfies Meta<typeof OtpSendButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhatsAppOn: Story = {};

export const WhatsAppOff: Story = { args: { whatsapp: false } };

export const Loading: Story = { args: { loading: true } };

export const Disabled: Story = { args: { disabled: true } };
