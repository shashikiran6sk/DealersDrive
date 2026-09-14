import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerProfileEditor } from '@/features/admin/dealer-profile-editor';

import { adminActionStub } from '../../mocks/admin-actions';

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
  tagline: 'Family-run since 1998 — hatchbacks under ₹6 lakh, every one inspected in-house.',
  specialities: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
  joinedLabel: '01 Dec 2025',
  creditBalance: 39,
  creditsHeld: 2,
  counts: { vehicles: 12, active: 7, pending: 1, enquiries: 30 },
  documents: [],
  allDocumentsVerified: false,
  profileChange: null,
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

export const Reading: Story = { args: { dealer: dealer() } };

export const WithGaps: Story = {
  args: {
    dealer: dealer({
      gstin: null,
      pan: null,
      mapsUrl: null,
      landline: null,
      tagline: null,
      specialities: [],
      pincode: null,
      contactPhoneDisplay: null,
      contactPhone: null,
    }),
  },
};

export const ReadOnlySeat: Story = {
  args: { dealer: dealer({ actions: { ...BASE.actions, canEdit: false } }) },
};

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
