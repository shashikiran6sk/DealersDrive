import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { phoneActionStub } from '../../mocks/phone-actions';

import { PhoneVerification } from '@/features/auth/phone-verification';

const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

function Harness({
  widget = FAKE_WIDGET,
  initialPhone = '9840012345',
  alreadyVerified = false,
  initialStage,
}: {
  widget?: PhoneOtpWidget | null;
  initialPhone?: string;
  alreadyVerified?: boolean;
  initialStage?: 'idle' | 'code' | 'failed';
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [verified, setVerified] = useState<string | null>(alreadyVerified ? initialPhone : null);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-[14px] p-[20px]">
      <label className="field">
        <span>Phone</span>
        <input
          className="input tnum"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
        />
      </label>

      <PhoneVerification
        widget={widget}
        phone={phone}
        fullName="R. Manikandan"
        verified={verified !== null && verified === phone.replace(/\D/g, '').slice(-10)}
        onVerified={(proved) => {
          setVerified(proved.replace(/\D/g, '').slice(-10));
        }}
        onContinue={() => undefined}
        onBeforeSend={() => phone.replace(/\D/g, '').length === 10}
        {...(initialStage ? { initialStage } : {})}
      />
    </div>
  );
}

const meta = {
  title: 'Forms/PhoneVerification',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    phoneActionStub.availability = {};
    phoneActionStub.result = { verified: true };
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SendCode: Story = {
  args: {},
  beforeEach: () => {
    phoneActionStub.result = { verified: true };
    phoneActionStub.availability = {};
    phoneActionStub.calls = [];
  },
};

export const NumberAlreadyRegistered: Story = {
  args: {},
  beforeEach: () => {
    phoneActionStub.availability = {
      error: 'That mobile number is already registered to another dealership.',
    };
  },
};

export const CodeEntry: Story = {
  args: { initialStage: 'code' },
  beforeEach: () => {
    phoneActionStub.result = { verified: true };
  },
};

export const Refused: Story = {
  args: { initialStage: 'failed' },
  beforeEach: () => {
    phoneActionStub.result = { error: 'That code could not be verified.' };
  },
};

export const AttemptsSpent: Story = {
  args: { initialStage: 'code' },
  beforeEach: () => {
    phoneActionStub.result = { error: 'That code could not be verified.' };
  },
};

export const Verified: Story = {
  args: { alreadyVerified: true },
};

export const NotConfigured: Story = {
  args: {
    widget: {
      enabled: false,
      driver: 'msg91',
      widgetId: null,
      tokenAuth: null,
      devCode: null,
      reason: 'Set MSG91_WIDGET_ID and MSG91_WIDGET_TOKEN to verify mobile numbers.',
    },
  },
};

export const ServiceUnreachable: Story = {
  args: { widget: null },
};
