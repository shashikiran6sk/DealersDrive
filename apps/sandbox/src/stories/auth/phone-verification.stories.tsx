import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { phoneActionStub } from '../../mocks/phone-actions';

/** C073: number → code → verified. Enter 123456; other codes show a refusal. */
const meta = {
  title: 'Auth/PhoneVerification',
  component: PhoneVerification,
  parameters: { layout: 'padded' },
  args: {
    phoneVerificationEnabled: true,
    verified: false,
    initialPhone: '',
    initialPhoneDisplay: '',
  },
  decorators: [
    (Story) => (
      <form className="max-w-[520px]">
        <Story />
      </form>
    ),
  ],
  beforeEach: () => {
    phoneActionStub.calls = [];
    phoneActionStub.start = {
      phone: '+919840012345',
      phoneDisplay: '+91 98400 12345',
      challengeId: '10000000-0000-4000-8000-000000000001',
      resendAfterSeconds: 60,
    };
    phoneActionStub.verify = {
      verified: true,
      phone: '+919840012345',
      phoneDisplay: '+91 98400 12345',
    };
  },
} satisfies Meta<typeof PhoneVerification>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Prefilled: Story = { args: { initialPhone: '+919840012345' } };
export const Verified: Story = {
  args: { verified: true, initialPhone: '+919840012345', initialPhoneDisplay: '+91 98400 12345' },
};
export const AlreadyRegistered: Story = {
  args: { initialPhone: '+919840012345' },
  beforeEach: () => {
    phoneActionStub.start = {
      fieldError: 'That mobile number is already registered to another dealership.',
    };
  },
};
export const ExpiredCode: Story = {
  args: { initialPhone: '+919840012345' },
  beforeEach: () => {
    phoneActionStub.verify = { error: 'That code has expired. Send a new one.' };
  },
};
export const TooManyRequests: Story = {
  args: { initialPhone: '+919840012345' },
  beforeEach: () => {
    phoneActionStub.start = { error: 'Too many attempts. Please wait before trying again.' };
  },
};
export const ProviderUnavailable: Story = {
  args: { initialPhone: '+919840012345' },
  beforeEach: () => {
    phoneActionStub.start = {
      error: 'Phone verification is temporarily unavailable. Try again shortly.',
    };
  },
};
export const NotConfigured: Story = { args: { phoneVerificationEnabled: false } };
export const StepRefused: Story = {
  args: { error: 'Verify your mobile number before continuing.' },
};
