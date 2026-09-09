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
  district: 'Vellore',
  state: 'Tamil Nadu',
  mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
  addressLine: '12 Katpadi Road',
  pincode: '632001',
  contactName: 'Ramesh Kumar',
  contactPhone: '9840012345',
  contactPhoneDisplay: '+91 98400 12345',
  contactEmail: 'owner@sri-lakshmi-motors.in',
  landline: '0416 224 8890',
  tagline: 'Family-run since 1998 — hatchbacks under ₹6 lakh, every one inspected in-house.',
  specialities: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
  joinedLabel: '01 Dec 2025',
  creditBalance: 39,
  creditsHeld: 2,
  counts: { vehicles: 12, active: 7, pending: 1, enquiries: 30 },
  documents: [],
  allDocumentsVerified: true,
  /** R34. Nothing waiting on a moderator is the ordinary state. */
  profileChange: null,
  yardPhotoUrl: null,
  recentLedger: [],
  actions: {
    canApprove: false,
    canReject: false,
    canRequestChanges: false,
    canSuspend: true,
    canReinstate: false,
    canGrantCredits: false,
    canEdit: true,
  },
};

function dealer(
  actions: Partial<AdminDealerDetail['actions']>,
  rest: Partial<AdminDealerDetail> = {},
): AdminDealerDetail {
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
      { canApprove: true, canReject: true, canRequestChanges: true, canSuspend: false },
      { status: 'PENDING_APPROVAL', statusLabel: 'Pending verification', statusTone: 'warn' },
    ),
  },
};

/**
 * PENDING_APPROVAL with a document still outstanding. `canApprove` is false —
 * and the control is rendered anyway, disabled, with a line saying why.
 *
 * It used to be absent, which is the more usual instinct and was wrong here.
 * An admin looking at a dealership waiting for a decision and finding no
 * approve button anywhere cannot tell "not allowed" from "not implemented" —
 * and for a while it genuinely was the second, because nothing in the console
 * could verify a document. The disabled control with its reason is the honest
 * version: the decision is available, its precondition is not met yet, and
 * `DocumentReview` above it is where that is fixed.
 */
export const PendingWithDocumentsOutstanding: Story = {
  args: {
    dealer: dealer(
      { canApprove: false, canReject: true, canRequestChanges: true, canSuspend: false },
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
 * SUSPENDED, with the way back.
 *
 * `POST /dealers/:id/reinstate` has existed and been documented since F045 and
 * the console called it from nowhere, which made suspension terminal in
 * practice while the state machine said otherwise. Restoring a dealership puts
 * every listing the suspension pulled back into the catalogue (rule 6), so the
 * control says so before it is pressed.
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

/**
 * A DRAFT dealership — still filling the form in, nothing to decide yet, but
 * rejectable.
 *
 * REJECTED as a *state* no longer occurs on this screen: rejecting deletes the
 * application outright, so there is no row left to render. The story that used
 * to show it was showing a screen the console can no longer reach.
 */
export const DraftAndIncomplete: Story = {
  args: {
    dealer: dealer(
      { canApprove: false, canReject: true, canRequestChanges: false, canSuspend: false },
      { status: 'DRAFT', statusLabel: 'Draft', statusTone: 'neutral' },
    ),
  },
};

/**
 * The two refusals, side by side, which is the comparison this screen exists to
 * make legible.
 *
 * **Request changes** is an ordinary control: type six characters, press it,
 * and the dealer gets their own form back with everything still in it. **Reject
 * application…** is behind a disclosure, spells out what it destroys, and will
 * not enable until the dealership's own name is typed into the confirmation box
 * — because it deletes the KYC scans, the yard photograph, the dealership row
 * and every field the applicant entered, and none of it comes back.
 *
 * Open the reject disclosure and read the paragraph before the button. That
 * paragraph is the whole reason the two are not styled alike.
 */
export const BothRefusals: Story = {
  args: {
    dealer: dealer(
      { canApprove: true, canReject: true, canRequestChanges: true, canSuspend: false },
      {
        status: 'PENDING_APPROVAL',
        statusLabel: 'Pending verification',
        statusTone: 'warn',
        documents: [],
      },
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
