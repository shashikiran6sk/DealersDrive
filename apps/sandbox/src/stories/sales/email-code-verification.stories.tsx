import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { emailCodeStub } from '../../mocks/sales-actions';

import { EmailCodeVerification } from '@/features/sales/email-code-verification';

const meta = {
  title: 'Sales/EmailCodeVerification',
  component: EmailCodeVerification,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[560px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    emailCodeStub.sendResult = null;
    emailCodeStub.verifyResult = null;
    emailCodeStub.correctCode = '123456';
  },
  args: { onVerified: () => undefined, initialEmail: '', disabled: false },
  argTypes: {
    onVerified: {
      control: false,
      description: 'Receives `{ email, emailTicket }` once the code is accepted (#299).',
    },
    initialEmail: { control: 'text' },
    disabled: { control: 'boolean' },
    initialStage: {
      control: 'select',
      options: ['email', 'code', 'failed', 'verified'],
      description: 'Sandbox entry point — the real flow always starts at `email`.',
    },
  },
} satisfies Meta<typeof EmailCodeVerification>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnterEmail: Story = { name: 'Enter the email' };

export const CodeSent: Story = {
  name: 'Code sent — resend on a countdown (123456 verifies)',
  args: { initialEmail: 'selvi@gmail.com', initialStage: 'code' },
};

export const CooldownRefused: Story = {
  name: 'Send refused — cooldown',
  args: { initialEmail: 'selvi@gmail.com' },
  beforeEach: () => {
    emailCodeStub.sendResult = {
      ok: false,
      message: 'A code was sent a moment ago. Wait 42 seconds before sending another.',
    };
  },
};

export const WrongCode: Story = {
  name: 'Wrong code',
  args: { initialEmail: 'selvi@gmail.com', initialStage: 'failed' },
};

export const Verified: Story = {
  args: { initialEmail: 'selvi@gmail.com', initialStage: 'verified' },
};
