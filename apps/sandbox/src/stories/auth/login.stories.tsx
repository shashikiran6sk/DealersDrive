import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { signInActionStub } from '../../mocks/sign-in-actions';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import {
  CustomerLogin,
  CustomerNameStep,
  DealerLogin,
  LOGIN_TEXT,
  LoginTabs,
} from '@/features/auth/login';

const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
  channel: 'sms',
};

const GOOGLE = { href: 'http://localhost:4000/v1/auth/google/start', enabled: true, reason: null };

const meta = {
  title: 'Forms/Login',
  component: LoginTabs,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100dvh', background: '#fff' }}>
        <AuthShell eyebrow="Dealers-Drive">
          <AuthHeading title={LOGIN_TEXT.title} />
          <Story />
        </AuthShell>
      </div>
    ),
  ],
  argTypes: {
    initial: { control: 'inline-radio', options: ['customer', 'dealer'] },
    customer: { control: false },
    dealer: { control: false },
  },
  args: {
    initial: 'customer',
    customer: <CustomerLogin widget={FAKE_WIDGET} returnTo="/" />,
    dealer: <DealerLogin widget={FAKE_WIDGET} google={GOOGLE} returnTo={null} error={null} />,
  },
  beforeEach: () => {
    signInActionStub.customer = { status: 'NAME_REQUIRED', phoneDisplay: '+91 98400 12345' };
    signInActionStub.signUp = { done: true };
    signInActionStub.dealer = { returnTo: '/dealer' };
  },
} satisfies Meta<typeof LoginTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Customer: Story = {};

export const Dealer: Story = { args: { initial: 'dealer' } };

export const DealerGoogleRefused: Story = {
  args: {
    initial: 'dealer',
    dealer: (
      <DealerLogin widget={FAKE_WIDGET} google={GOOGLE} returnTo={null} error="account_suspended" />
    ),
  },
};

export const DealerGoogleNotConfigured: Story = {
  args: {
    initial: 'dealer',
    dealer: (
      <DealerLogin
        widget={FAKE_WIDGET}
        google={{ ...GOOGLE, enabled: false, reason: 'GOOGLE_CLIENT_ID is not set on the API.' }}
        returnTo={null}
        error={null}
      />
    ),
  },
};

export const NewCustomerName: Story = {
  args: {
    customer: (
      <CustomerNameStep
        phoneDisplay="+91 98400 12345"
        onCreated={() => undefined}
        onRestart={() => undefined}
      />
    ),
  },
};

export const PhoneUnavailable: Story = {
  args: {
    customer: (
      <CustomerLogin
        widget={{ ...FAKE_WIDGET, enabled: false, driver: 'msg91', devCode: null }}
        returnTo="/"
      />
    ),
  },
};
