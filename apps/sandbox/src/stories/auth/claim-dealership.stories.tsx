import type { DealerClaimPreview, PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ClaimDealership } from '@/features/claim/claim-dealership';

const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

const PREVIEW: DealerClaimPreview = {
  state: 'AWAITING_EMAIL',
  dealerName: 'Claimable Motors',
  city: 'Katpadi',
  district: 'Vellore',
  emailMasked: 's••••@gmail.com',
  phoneMasked: '+91 ••••• •2345',
  phoneLast4: '2345',
  assistedBy: 'Arun',
  expiresAt: '2026-10-09T10:00:00.000Z',
};

const meta = {
  title: 'Auth/ClaimDealership',
  component: ClaimDealership,
  args: { token: 'a'.repeat(43), preview: PREVIEW, widget: FAKE_WIDGET },
  argTypes: {
    preview: { control: 'object', description: 'GET /v1/dealer-claims/:token (**R113**).' },
    widget: { control: false },
    token: { control: false },
  },
} satisfies Meta<typeof ClaimDealership>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmEmail: Story = { name: 'Step 1 — confirm the email' };

export const VerifyPhone: Story = {
  name: 'Step 2 — OTP on the dealership’s phone',
  args: { preview: { ...PREVIEW, state: 'AWAITING_CLAIM' } },
};

export const AlreadyClaimed: Story = { args: { preview: { ...PREVIEW, state: 'CLAIMED' } } };

export const Expired: Story = { args: { preview: { ...PREVIEW, state: 'EXPIRED' } } };

export const Superseded: Story = { args: { preview: { ...PREVIEW, state: 'SUPERSEDED' } } };
