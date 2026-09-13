import type { AdminAccessEntry } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AdminAccessPanel } from '@/features/admin/admin-access';

import { accessActionStub } from '../../mocks/access-actions';

/**
 * R42 (C064b) — who may open this console.
 *
 * **The two sources are the whole component.** An `ALLOWLIST` row is an address
 * in `ADMIN_ALLOWLIST`, written into the deployment: it shows its tag and no
 * Withdraw control, because removing it is a change to the environment and a
 * button that appeared to do that and did not would be worse than none. A
 * `GRANT` row is a seat a SUPER_ADMIN handed out here, with who handed it over,
 * and it can be taken back the same way.
 *
 * Two refusals are worth seeing rendered, because both are doors somebody could
 * otherwise walk through and not walk back out of:
 *
 *   · **your own row** says `You` where the control would be — withdrawing it
 *     could leave nobody able to let you back in;
 *   · **an allow-listed row** says where the address actually comes from.
 *
 * Both are enforced on the server as well. The panel is not the guard; it is
 * the explanation.
 *
 * A granted address takes effect on that person's **next sign-in** — they still
 * sign in with Google, and the address has to be the one Google knows them by.
 * The copy under the heading says so, because "I granted it and nothing
 * happened" is the support question this screen would otherwise generate.
 *
 * The Server Actions are stubbed (`src/mocks/access-actions.ts`, coupling C-4).
 */
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

/** An address on the list that nobody has signed in with. There is no row for them. */
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

/** The day the feature ships: one allow-listed operator and nobody else. */
export const AllowlistedOnly: Story = {
  args: { entries: [ALLOWLISTED] },
};

/** The ordinary state — the deployment's operator, and two people they let in. */
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

/**
 * An allow-listed address with no account behind it yet. `userId` is null, and
 * the list still shows it — leaving it out would be wrong about who can get in.
 */
export const NotSignedInYet: Story = {
  args: { entries: [ALLOWLISTED, NEVER_ARRIVED] },
};

/**
 * A granted seat held by somebody who also runs a dealership — R41's case seen
 * from this screen. Withdrawing it closes their console and leaves their dealer
 * account exactly as it was.
 */
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

/** Mid-write. The stub delays, so the pending button is a state you can look at. */
export const Granting: Story = {
  args: { entries: [ALLOWLISTED, entry()] },
  decorators: [
    (Story) => {
      accessActionStub.delayMs = 8000;
      return <Story />;
    },
  ],
};

/** The server refused. Type an address and press Grant access. */
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
