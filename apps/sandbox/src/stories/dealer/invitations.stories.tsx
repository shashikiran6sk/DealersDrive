import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { invitationActionStub } from '../../mocks/invitation-actions';

import { InvitationList } from '@/features/invitations';

const meta = {
  title: 'Dealer/Invitations',
  component: InvitationList,
  args: {
    invitations: [
      {
        id: '00000001-2222-4222-8222-222222222222',
        dealer: { brandName: 'ABC Motors', city: 'Vellore' },
        role: 'STAFF',
        roleLabel: 'Staff',
        invitedByName: 'Shashikiran',
        expiresAt: '2026-10-09T09:30:00.000Z',
        expiresLabel: '9 Oct 2026',
      },
    ],
  },
  beforeEach: () => {
    invitationActionStub.result = { ok: true };
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof InvitationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {};

export const Nothing: Story = { args: { invitations: [] } };

export const Expired: Story = {
  beforeEach: () => {
    invitationActionStub.result = {
      ok: false,
      message: 'This invitation has expired. Ask the dealership to invite your number again.',
    };
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };
