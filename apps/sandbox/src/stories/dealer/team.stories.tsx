import type { DealerTeamResponse, TeamMember } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { teamActionStub } from '../../mocks/team-actions';

import { TeamPanel } from '@/features/dealer/team';

function member(n: number, overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: `0000000${String(n)}-1111-4111-8111-111111111111`,
    name: 'Arun Kumar',
    initials: 'AK',
    phoneDisplay: '+91 98765 00001',
    email: null,
    role: 'MANAGER',
    roleLabel: 'Manager',
    joinedAt: '2026-10-01T10:00:00.000Z',
    joinedLabel: '1 Oct 2026',
    isYou: false,
    manageable: true,
    ...overrides,
  };
}

const OWNER = member(1, {
  name: 'Shashikiran',
  initials: 'S',
  phoneDisplay: '+91 98400 12345',
  email: 'shashikiran@abcmotors.in',
  role: 'OWNER',
  roleLabel: 'Owner',
  joinedLabel: '15 Jan 2026',
  isYou: true,
  manageable: false,
});

const FULL: DealerTeamResponse = {
  members: [
    OWNER,
    member(2),
    member(3, {
      name: 'Priya Devi',
      initials: 'PD',
      phoneDisplay: '+91 98765 00002',
      role: 'STAFF',
      roleLabel: 'Staff',
    }),
  ],
  invitations: [
    {
      id: '00000009-1111-4111-8111-111111111111',
      phoneDisplay: '+91 98765 00003',
      role: 'STAFF',
      roleLabel: 'Staff',
      status: 'PENDING',
      statusLabel: 'Waiting for sign-in',
      invitedAt: '2026-10-02T09:30:00.000Z',
      expiresAt: '2026-10-09T09:30:00.000Z',
      expiresLabel: '9 Oct 2026',
    },
    {
      id: '00000008-1111-4111-8111-111111111111',
      phoneDisplay: '+91 98765 00004',
      role: 'MANAGER',
      roleLabel: 'Manager',
      status: 'EXPIRED',
      statusLabel: 'Expired',
      invitedAt: '2026-09-20T09:30:00.000Z',
      expiresAt: '2026-09-27T09:30:00.000Z',
      expiresLabel: '27 Sep 2026',
    },
  ],
};

const meta = {
  title: 'Dealer/Team',
  component: TeamPanel,
  args: { team: FULL },
  beforeEach: () => {
    teamActionStub.result = { ok: true };
    teamActionStub.calls = [];
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TeamPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnerWithTeam: Story = {};

export const JustTheOwner: Story = { args: { team: { members: [OWNER], invitations: [] } } };

export const InviteRefused: Story = {
  beforeEach: () => {
    teamActionStub.result = {
      ok: false,
      message: 'That number already belongs to a member of this dealership.',
    };
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};
