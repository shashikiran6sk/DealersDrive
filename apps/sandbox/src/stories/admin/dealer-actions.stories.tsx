import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerAdminActions } from '@/features/admin/dealer-actions';

import { adminActionStub } from '../../mocks/admin-actions';

/**
 * D4 (C062) — the dealer-moderation controls.
 *
 * **The `actions` block is the whole component.** It arrives resolved from the
 * API, so which controls appear is not a decision this component makes and not
 * one a story can fake around: every scenario below is a different `actions`
 * shape, which is exactly how the console behaves.
 *
 * Two things are worth checking by eye rather than by reading the code:
 *
 *   · **Suspend states its blast radius before the button is pressed.** Public
 *     visibility needs `dealer.status === ACTIVE` as well as an approved
 *     listing (rule 6), so one click takes every live car off the marketplace.
 *     The count is in the sentence under the button for that reason.
 *   · **The suspend button is disabled until the reason has substance.** The
 *     dealer reads it verbatim; "no" generates a support call. Six characters
 *     is what `ReasonInput` enforces server-side, and this is the client half
 *     of the same rule.
 *
 * The Server Actions are stubbed — `src/mocks/admin-actions.ts`, coupling C-4.
 */
const BASE: AdminDealerDetail = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'sri-lakshmi-motors',
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  initials: 'SL',
  status: 'ACTIVE',
  statusLabel: 'Verified dealer',
  statusTone: 'ok',
  statusReason: null,
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  city: 'Vellore',
  addressLine: '12 Katpadi Road',
  contactName: 'Ramesh Kumar',
  contactPhone: '9840012345',
  contactPhoneDisplay: '+91 98400 12345',
  contactEmail: 'owner@sri-lakshmi-motors.in',
  joinedLabel: '01 Dec 2025',
  creditBalance: 39,
  creditsHeld: 2,
  counts: { vehicles: 12, active: 7, pending: 1, enquiries: 30 },
  documents: [],
  allDocumentsVerified: true,
  recentLedger: [],
  actions: {
    canApprove: false,
    canReject: false,
    canSuspend: true,
    canReinstate: false,
    canGrantCredits: false,
  },
};

function dealer(actions: Partial<AdminDealerDetail['actions']>, rest: Partial<AdminDealerDetail> = {}): AdminDealerDetail {
  return { ...BASE, ...rest, actions: { ...BASE.actions, ...actions } };
}

const meta = {
  title: 'Admin/DealerAdminActions',
  component: DealerAdminActions,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 900;
      adminActionStub.result = { ok: true };
      adminActionStub.calls = [];
      return (
        <div style={{ maxWidth: 640 }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof DealerAdminActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * PENDING_APPROVAL with all three KYC documents verified — the one state in
 * which approval is offered. The note is internal; the dealer never sees it.
 */
export const PendingAndReadyToApprove: Story = {
  args: {
    dealer: dealer(
      { canApprove: true, canReject: true, canSuspend: false },
      { status: 'PENDING_APPROVAL', statusLabel: 'Pending verification', statusTone: 'warn' },
    ),
  },
};

/**
 * PENDING_APPROVAL with a document still outstanding. `canApprove` is false, so
 * the approve control is simply absent — the console does not render a disabled
 * button it would have to explain.
 */
export const PendingWithDocumentsOutstanding: Story = {
  args: {
    dealer: dealer(
      { canApprove: false, canReject: true, canSuspend: false },
      {
        status: 'PENDING_APPROVAL',
        statusLabel: 'Pending verification',
        statusTone: 'warn',
        allDocumentsVerified: false,
      },
    ),
  },
};

/**
 * ACTIVE. Type six characters into the reason to watch the destructive button
 * become available — and read the sentence under it first.
 */
export const ActiveAndSuspendable: Story = {
  args: { dealer: dealer({ canSuspend: true }) },
};

/** An active dealership with nothing live yet. The blast radius is honestly zero. */
export const ActiveWithNoLiveListings: Story = {
  args: {
    dealer: dealer({ canSuspend: true }, { counts: { ...BASE.counts, active: 0 } }),
  },
};

/**
 * SUSPENDED. `POST /dealers/:id/reinstate` exists and is documented, but the
 * baseline console calls it from nowhere — so the card says so rather than
 * rendering a button this feature would have had to invent.
 */
export const Suspended: Story = {
  args: {
    dealer: dealer(
      { canSuspend: false, canReinstate: true },
      {
        status: 'SUSPENDED',
        statusLabel: 'Suspended',
        statusTone: 'err',
        statusReason: 'Three buyer reports of misrepresented kilometres.',
      },
    ),
  },
};

/** REJECTED — a terminal state with no console action at all. */
export const Rejected: Story = {
  args: {
    dealer: dealer(
      { canApprove: false, canReject: false, canSuspend: false, canReinstate: false },
      { status: 'REJECTED', statusLabel: 'Rejected', statusTone: 'err' },
    ),
  },
};

/**
 * The action in flight. The stub holds for eight seconds so the `aria-busy`
 * button and the frozen form are visible; press Approve to see it.
 */
export const Pending: Story = {
  args: {
    dealer: dealer(
      { canApprove: true, canSuspend: false },
      { status: 'PENDING_APPROVAL', statusLabel: 'Pending verification', statusTone: 'warn' },
    ),
  },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 8_000;
      adminActionStub.result = { ok: true };
      return <Story />;
    },
  ],
};

/**
 * The API refused. The message is the one the API sent, not a generic one —
 * an admin who is told "that did not work" cannot tell a permissions problem
 * from a stale page.
 */
export const ServerError: Story = {
  args: { dealer: dealer({ canSuspend: true }) },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 400;
      adminActionStub.result = {
        ok: false,
        message: 'This action needs the admin:dealer:approve permission.',
      };
      return <Story />;
    },
  ],
};
