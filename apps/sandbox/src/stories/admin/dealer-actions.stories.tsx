import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerAdminActions } from '@/features/admin/dealer-actions';

import { adminActionStub } from '../../mocks/admin-actions';

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

export const PendingAndReadyToApprove: Story = {
  args: {
    dealer: dealer(
      { canApprove: true, canReject: true, canRequestChanges: true, canSuspend: false },
      { status: 'PENDING_APPROVAL', statusLabel: 'Pending verification', statusTone: 'warn' },
    ),
  },
};

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

export const ActiveAndSuspendable: Story = {
  args: { dealer: dealer({ canSuspend: true }) },
};

export const ActiveWithNoLiveListings: Story = {
  args: {
    dealer: dealer({ canSuspend: true }, { counts: { ...BASE.counts, active: 0 } }),
  },
};

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

export const DraftAndIncomplete: Story = {
  args: {
    dealer: dealer(
      { canApprove: false, canReject: true, canRequestChanges: false, canSuspend: false },
      { status: 'DRAFT', statusLabel: 'Draft', statusTone: 'neutral' },
    ),
  },
};

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
