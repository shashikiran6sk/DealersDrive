import type { AdminMemberDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AdminMembers } from '@/features/admin/admin-members';

import { memberActionStub } from '../../mocks/member-actions';

function member(overrides: Partial<AdminMemberDto> = {}): AdminMemberDto {
  return {
    id: '7a2b3c4d-2222-4e5f-8a9b-0c1d2e3f4a5b',
    userId: '8b3c4d5e-3333-4f60-9bac-1d2e3f4a5b6c',
    name: 'Arun Field Sales',
    email: 'arun.sales@dealers-drive.in',
    role: 'SALES_REP',
    roleLabel: 'Sales representative',
    status: 'ACTIVE',
    statusLabel: 'Active',
    source: 'INVITED',
    invitedByEmail: 'ops@dealers-drive.in',
    invitedAt: '2026-10-01T08:00:00.000Z',
    activatedAt: '2026-10-01T09:30:00.000Z',
    lastLoginLabel: '2 hours ago',
    disabledAt: null,
    disabledReason: null,
    isYou: false,
    lockedReason: null,
    ...overrides,
  };
}

const YOU = member({
  id: 'a1',
  userId: 'u1',
  name: 'Dealers-Drive Operations',
  email: 'ops@dealers-drive.in',
  role: 'SUPER_ADMIN',
  roleLabel: 'Super admin',
  source: 'BOOTSTRAP',
  invitedByEmail: null,
  isYou: true,
  lockedReason: 'This is you',
  lastLoginLabel: 'just now',
});

const INVITED = member({
  id: 'a2',
  email: 'priya.ops@dealers-drive.in',
  name: 'Priya',
  role: 'MODERATOR',
  roleLabel: 'Operations',
  status: 'INVITED',
  statusLabel: 'Invited',
  activatedAt: null,
  lastLoginLabel: 'Never',
});

const DISABLED = member({
  id: 'a3',
  email: 'former@dealers-drive.in',
  name: 'Former Rep',
  status: 'DISABLED',
  statusLabel: 'Disabled',
  disabledAt: '2026-10-05T10:00:00.000Z',
  disabledReason: 'Left the company on 5 October.',
});

const COUNTS = { ALL: 4, ACTIVE: 2, INVITED: 1, DISABLED: 1 };

const meta = {
  component: AdminMembers,
  title: 'Admin/AdminMembers',
  parameters: { layout: 'padded' },
  args: { status: 'ALL', counts: COUNTS, members: [YOU, member(), INVITED, DISABLED] },
  decorators: [
    (Story) => {
      memberActionStub.delayMs = 700;
      memberActionStub.result = { ok: true };
      return (
        <div style={{ maxWidth: 1000 }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof AdminMembers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedTeam: Story = {};

export const InvitedOnly: Story = {
  args: { status: 'INVITED', members: [INVITED], counts: COUNTS },
};

export const DisabledWithReason: Story = {
  args: { status: 'DISABLED', members: [DISABLED], counts: COUNTS },
};

export const EmptyFilter: Story = {
  args: { status: 'DISABLED', members: [], counts: { ...COUNTS, DISABLED: 0 } },
};

export const Refused: Story = {
  decorators: [
    (Story) => {
      memberActionStub.result = {
        ok: false,
        message:
          'That address is already a team member. Change their role or re-activate them instead.',
      };
      return <Story />;
    },
  ],
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
