import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerProfileEditor } from '@/features/admin/dealer-profile-editor';

import { adminActionStub } from '../../mocks/admin-actions';

/**
 * D3 (C062c) — the dealership's own answers, editable from the review screen.
 *
 * **Why it is not just a definition list.** It was one, and that is right for
 * the reviews that end in a decision and wrong for the ones that end in a
 * correction. A moderator holding the GST certificate can see that the dealer
 * typed one digit of the GSTIN wrong or spelt the district `Vellore Dist.`; the
 * alternative to fixing it here is a round trip that costs a working day per
 * character.
 *
 * Three things to check by eye:
 *
 *   · **It reads before it writes.** The card is a definition list until *Edit*
 *     is pressed. A review screen full of live inputs invites edits that were
 *     meant to be readings, and these same values are what a reviewer compares
 *     against a document.
 *   · **Save is disabled until something actually changed**, and only what
 *     changed is sent. `UpdateDealerInput` is partial; re-writing `legalName`
 *     and `city` with the same values on every save would put the
 *     duplicate-name check in the position of having to ignore a collision with
 *     the row being edited, on a field nobody touched.
 *   · **A refusal lands on the field it names.** The API answers with paths
 *     like `body.address.city`, and `ServerRefusal` below shows what that looks
 *     like against the boxes.
 *
 * The Server Action is stubbed — `src/mocks/admin-actions.ts`, coupling C-4.
 */
const BASE: AdminDealerDetail = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'sri-lakshmi-motors',
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  initials: 'SL',
  status: 'PENDING_APPROVAL',
  statusLabel: 'Pending verification',
  statusTone: 'warn',
  statusReason: null,
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  addressLine: '12 Katpadi Road',
  pincode: '632001',
  mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
  contactName: 'Ramesh Kumar',
  contactPhone: '9840012345',
  contactPhoneDisplay: '+91 98400 12345',
  contactEmail: 'owner@sri-lakshmi-motors.in',
  landline: '0416 224 8890',
  joinedLabel: '01 Dec 2025',
  creditBalance: 39,
  creditsHeld: 2,
  counts: { vehicles: 12, active: 7, pending: 1, enquiries: 30 },
  documents: [],
  allDocumentsVerified: false,
  yardPhotoUrl: null,
  recentLedger: [],
  actions: {
    canApprove: false,
    canReject: true,
    canRequestChanges: true,
    canSuspend: false,
    canReinstate: false,
    canGrantCredits: false,
    canEdit: true,
  },
};

function dealer(overrides: Partial<AdminDealerDetail> = {}): AdminDealerDetail {
  return {
    ...BASE,
    ...overrides,
    actions: { ...BASE.actions, ...(overrides.actions ?? {}) },
  };
}

const meta = {
  title: 'Admin/DealerProfileEditor',
  component: DealerProfileEditor,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 700;
      adminActionStub.result = { ok: true };
      adminActionStub.calls = [];
      return (
        <div style={{ maxWidth: 720 }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof DealerProfileEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The resting state: everything the dealer entered, read-only, with one Edit. */
export const Reading: Story = { args: { dealer: dealer() } };

/**
 * A half-finished application. Every empty field reads `—` rather than
 * disappearing — the reviewer's question is often "what has *not* been
 * answered", and a row that vanishes cannot answer it.
 */
export const WithGaps: Story = {
  args: {
    dealer: dealer({
      gstin: null,
      pan: null,
      mapsUrl: null,
      landline: null,
      pincode: null,
      contactPhoneDisplay: null,
      contactPhone: null,
    }),
  },
};

/**
 * A SUPPORT seat, which may read the record and not change it. The Edit button
 * is absent rather than disabled: there is no state from which this operator can
 * reach the form, so offering it would be a control that never works.
 */
export const ReadOnlySeat: Story = {
  args: { dealer: dealer({ actions: { ...BASE.actions, canEdit: false } }) },
};

/**
 * The save in flight. Press Edit, change a field, press Save — the stub holds
 * for eight seconds so the busy button and the frozen form are visible.
 */
export const Saving: Story = {
  args: { dealer: dealer() },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 8_000;
      adminActionStub.result = { ok: true };
      return <Story />;
    },
  ],
};

/**
 * The API refused, and named the field.
 *
 * `GSTIN_ALREADY_REGISTERED` is the one that actually happens: two applications
 * for one registration, and the second is a duplicate rather than a typo. Press
 * Edit, change anything, press Save.
 */
export const ServerRefusal: Story = {
  args: { dealer: dealer() },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 400;
      adminActionStub.result = {
        ok: false,
        message: 'That GSTIN is already registered to another dealership.',
        errors: { 'body.gstin': 'Already registered.' },
      };
      return <Story />;
    },
  ],
};
