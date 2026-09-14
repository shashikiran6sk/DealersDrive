import type { DealerProfile } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactElement } from 'react';

import { DealerProfileForm } from '@/features/dealer/profile-form';

import { dealerProfileStub, withdrawStub, type ProfileFormState } from '../../mocks/dealer-actions';

const BASE: DealerProfile = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'sri-lakshmi-motors',
  status: 'ACTIVE',
  statusLabel: 'Active',
  statusReason: null,
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  tagline: 'Hatchbacks under ₹6 lakh, inspected in-house',
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  contact: {
    fullName: 'Ramesh Kumar',
    phone: '9840012345',
    phoneDisplay: '+91 98400 12345',
    email: 'owner@sri-lakshmi-motors.in',
    landline: '0416 224 8890',
  },
  address: {
    line: '12 Katpadi Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    mapKind: 'PLACE',
  },
  specialities: ['Hatchbacks', 'RC transfer', 'Exchange'],
  workingHours: { mon_sat: '09:30-20:00', sun: null },
  establishedYear: 1998,
  logoMediaId: null,
  coverMediaId: null,
  creditBalance: 39,
  creditsHeld: 2,
  activeListings: 7,
  approvedAt: '2026-01-14T06:12:00.000Z',
  createdAt: '2025-12-01T09:00:00.000Z',
  profileChange: null,
};

function stub(delayMs: number, result: ProfileFormState) {
  return function withStub(Story: () => ReactElement) {
    dealerProfileStub.delayMs = delayMs;
    dealerProfileStub.result = result;
    dealerProfileStub.calls = [];
    return <Story />;
  };
}

const meta: Meta<typeof DealerProfileForm> = {
  title: 'Dealer/DealerProfileForm',
  component: DealerProfileForm,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[900px]">
        <Story />
      </div>
    ),
  ],
};

const SAVED: ProfileFormState = { status: 'saved', fieldErrors: {} };

export default meta;
type Story = StoryObj<typeof DealerProfileForm>;

export const Populated: Story = {
  args: { dealer: BASE },
  decorators: [stub(900, SAVED)],
};

export const Sparse: Story = {
  args: {
    dealer: {
      ...BASE,
      status: 'PENDING_APPROVAL',
      statusLabel: 'Pending verification',
      tagline: null,
      specialities: [],
      establishedYear: null,
      workingHours: null,
      contact: { ...BASE.contact, email: null, landline: null },
      address: { ...BASE.address, line: null, district: null, mapsUrl: null, mapKind: 'NONE' },
    },
  },
  decorators: [stub(900, SAVED)],
};

export const MapIsOnlyAPin: Story = {
  args: { dealer: { ...BASE, address: { ...BASE.address, mapKind: 'POINT' } } },
  decorators: [stub(900, SAVED)],
};

export const MapCouldNotBeRead: Story = {
  args: { dealer: { ...BASE, address: { ...BASE.address, mapKind: 'NONE' } } },
  decorators: [stub(900, SAVED)],
};

export const Saved: Story = {
  args: { dealer: BASE },
  decorators: [stub(0, SAVED)],
};

export const ServerRefusal: Story = {
  args: { dealer: BASE },
  decorators: [
    stub(0, {
      status: 'error',
      fieldErrors: {
        legalName: 'Another dealership in Vellore already trades under this name.',
        addressMapsUrl: 'That does not look like a Google Maps link.',
      },
    }),
  ],
};

export const ServerError: Story = {
  args: { dealer: BASE },
  decorators: [
    stub(0, {
      status: 'error',
      fieldErrors: {},
      message: 'Something went wrong at our end. Please try again.',
    }),
  ],
};

export const Saving: Story = {
  args: { dealer: BASE },
  decorators: [stub(3000, SAVED)],
};

export const ChangeWaitingForReview: Story = {
  args: {
    dealer: {
      ...BASE,
      profileChange: {
        id: '9a1e4c22-0000-4000-8000-000000000009',
        status: 'PENDING',
        statusLabel: 'Waiting for review',
        tagline: 'Only diesel SUVs now, every one with a full service history.',
        specialities: ['SUVs', 'Exchange', 'Bank loan tie-ups'],
        submittedAtLabel: '09 Sep 2026',
        reviewedAtLabel: null,
        decisionReason: null,
      },
    },
  },
};

export const Cancelling: Story = {
  ...ChangeWaitingForReview,
  beforeEach: () => {
    withdrawStub.delayMs = 8000;
    withdrawStub.result = null;
  },
};

export const CancelRefused: Story = {
  ...ChangeWaitingForReview,
  beforeEach: () => {
    withdrawStub.delayMs = 500;
    withdrawStub.result = 'We could not cancel that change.';
  },
};

export const ChangeRefused: Story = {
  args: {
    dealer: {
      ...BASE,
      profileChange: {
        id: '9a1e4c22-0000-4000-8000-000000000009',
        status: 'REJECTED',
        statusLabel: 'Not approved',
        tagline: 'Best prices in Vellore — call 98400 12345 direct!',
        specialities: [],
        submittedAtLabel: '09 Sep 2026',
        reviewedAtLabel: '09 Sep 2026',
        decisionReason:
          'The tagline ends with a mobile number. Buyers reach you through the contact button, which logs the lead for you — please remove it.',
      },
    },
  },
};
