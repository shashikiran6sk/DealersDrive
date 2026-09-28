import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhoneSignIn } from '@/features/auth/phone-sign-in';

const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

const meta = {
  title: 'Forms/PhoneSignIn',
  component: PhoneSignIn,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[480px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    widget: { control: false, description: 'GET /v1/auth/sign-in/phone/widget (**R60**).' },
    onProved: {
      control: false,
      description: 'Handed the number and the widget token; answers an error or null.',
    },
  },
  args: {
    widget: FAKE_WIDGET,
    idPrefix: 'story',
    onProved: () => new Promise((resolve) => setTimeout(() => resolve(null), 600)),
  },
} satisfies Meta<typeof PhoneSignIn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnterNumber: Story = {};

export const CodeEntry: Story = {
  args: { initialStage: 'code', initialPhone: '9840012345' },
};

export const Refused: Story = {
  args: {
    initialPhone: '9840012345',
    onProved: () =>
      Promise.resolve('That code could not be verified. Request a new one and try again.'),
  },
};

export const NotConfigured: Story = {
  args: {
    widget: { ...FAKE_WIDGET, enabled: false, driver: 'msg91', devCode: null, reason: null },
  },
};
