import type { AdminAccessEntry } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AdminAccessPanel } from '@/features/admin/admin-access';

import { accessActionStub } from '../../mocks/access-actions';

const CURRENT = '2f1c4a8e-1111-4b2c-9d3e-5a6b7c8d9e01';

function entry(overrides: Partial<AdminAccessEntry> = {}): AdminAccessEntry {
  return {
    userId: '7a2b3c4d-2222-4e5f-8a9b-0c1d2e3f4a5b',
    email: 'ops.two@dealers-drive.in',
    fullName: 'Second Operator',
    adminRole: 'MODERATOR',
    source: 'GRANT',
    sourceLabel: 'Granted',
    grantedByEmail: 'ops@dealers-drive.in',
    grantedAt: '2026-09-10T08:00:00.000Z',
    lastLoginLabel: '2 days ago',
    canRevoke: true,
    revokeBlockedReason: null,
    ...overrides,
  };
}

const ALLOWLISTED = entry({
  userId: CURRENT,
  email: 'ops@dealers-drive.in',
  fullName: 'Dealers-Drive Operations',
  adminRole: 'SUPER_ADMIN',
  source: 'ALLOWLIST',
  sourceLabel: 'Allow-listed',
  grantedByEmail: null,
  grantedAt: null,
  lastLoginLabel: 'just now',
  canRevoke: false,
  revokeBlockedReason: 'Set in ADMIN_ALLOWLIST',
});

const NEVER_ARRIVED = entry({
  userId: null,
  email: 'ops.standby@dealers-drive.in',
  fullName: null,
  adminRole: 'SUPER_ADMIN',
  source: 'ALLOWLIST',
  sourceLabel: 'Allow-listed',
  grantedByEmail: null,
  grantedAt: null,
  lastLoginLabel: 'Never',
  canRevoke: false,
  revokeBlockedReason: 'Set in ADMIN_ALLOWLIST',
});

const meta = {
  component: AdminAccessPanel,
  title: 'Admin/AdminAccessPanel',
  parameters: { layout: 'padded' },
  args: { currentUserId: CURRENT },
  decorators: [
    (Story) => {
      accessActionStub.delayMs = 700;
      accessActionStub.result = { ok: true };
      return (
        <div style={{ maxWidth: 900 }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof AdminAccessPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllowlistedOnly: Story = {
  args: { entries: [ALLOWLISTED] },
};

export const AllowlistedAndGranted: Story = {
  args: {
    entries: [
      ALLOWLISTED,
      entry(),
      entry({
        userId: '9c8d7e6f-3333-4a1b-8c2d-3e4f5a6b7c8d',
        email: 'support@dealers-drive.in',
        fullName: 'Support Desk',
        adminRole: 'SUPPORT',
        lastLoginLabel: 'Never',
      }),
    ],
  },
};

export const NotSignedInYet: Story = {
  args: { entries: [ALLOWLISTED, NEVER_ARRIVED] },
};

export const GrantedToADealer: Story = {
  args: {
    entries: [
      ALLOWLISTED,
      entry({
        email: 'ramesh@sri-lakshmi-motors.in',
        fullName: 'Ramesh Kumar',
        lastLoginLabel: '18 min ago',
      }),
    ],
  },
};

export const Granting: Story = {
  args: { entries: [ALLOWLISTED, entry()] },
  decorators: [
    (Story) => {
      accessActionStub.delayMs = 8000;
      return <Story />;
    },
  ],
};

export const Refused: Story = {
  args: { entries: [ALLOWLISTED, entry()] },
  decorators: [
    (Story) => {
      accessActionStub.result = {
        ok: false,
        message:
          'That address is on ADMIN_ALLOWLIST. Remove it from the deployment to withdraw access.',
      };
      return <Story />;
    },
  ],
};
