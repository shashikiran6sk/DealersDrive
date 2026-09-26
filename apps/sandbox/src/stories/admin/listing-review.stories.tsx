import type { AdminListingDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ListingReview } from '@/features/admin/listing-review';

const CHECKS: AdminListingDetail['checks'] = [
  [
    'REGISTRATION',
    'Registration checked',
    'The plate on the car matches the number entered and the RC.',
  ],
  ['MAKE_MODEL', 'Make and model checked', 'The car is the make and model entered.'],
  ['VARIANT', 'Variant checked', 'The trim on the car matches.'],
  ['YEAR', 'Year checked', 'Manufacturing and registration years match the RC.'],
  ['ODOMETER', 'Odometer checked', 'The reading on the dashboard matches.'],
  ['OWNERSHIP', 'Ownership checked', 'The number of owners matches the RC.'],
  ['PRICING', 'Pricing checked', 'The price is plausible, with no contact in the text.'],
].map(([key, label, hint], index) => ({
  key: key as AdminListingDetail['checks'][number]['key'],
  label: label!,
  hint: hint!,
  checked: index < 3,
  checkedAt: index < 3 ? '2026-09-26T10:00:00.000Z' : null,
}));

const DETAIL: AdminListingDetail = {
  listing: {
    id: '11111111-1111-4111-8111-111111111111',
    vehicleId: '22222222-2222-4222-8222-222222222222',
    title: '2023 Hyundai Creta SX(O)',
    registrationDisplay: 'KA 01 AB 1234',
    summary: 'Petrol · Automatic · 22,400 km',
    priceLabel: '₹14,50,000',
    status: 'PENDING_REVIEW',
    statusLabel: 'Pending review',
    statusTone: 'warn',
    dealer: { id: '33333333-3333-4333-8333-333333333333', name: 'Sri Lakshmi Motors', slug: 'sri' },
    location: 'Katpadi, Vellore',
    submittedAt: '2026-09-26T09:00:00.000Z',
    submittedLabel: '26 Sep 2026',
    waitingLabel: '3 hours ago',
    resubmission: false,
    photography: { status: 'NOT_STARTED', label: 'Not photographed', tone: 'neutral' },
    reason: null,
    submissionCount: 1,
    publishedAt: null,
  },
  dealer: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Sri Lakshmi Motors',
    slug: 'sri',
    status: 'ACTIVE',
    statusLabel: 'Active',
    statusTone: 'ok',
    location: 'Katpadi, Vellore',
    phoneDisplay: '+91 98400 12345',
  },
  sections: [
    {
      key: 'registration',
      title: 'Registration',
      rows: [
        { label: 'Registration number', value: 'KA 01 AB 1234' },
        { label: 'RTO', value: 'KA01' },
        { label: 'Registration year', value: '2023' },
      ],
    },
    {
      key: 'basics',
      title: 'Vehicle basics',
      rows: [
        { label: 'Make', value: 'Hyundai' },
        { label: 'Model', value: 'Creta' },
        { label: 'Variant', value: 'SX(O)' },
        { label: 'Manufacturing year', value: '2023' },
        { label: 'Fuel', value: 'Petrol' },
        { label: 'Transmission', value: 'Automatic' },
        { label: 'Body type', value: 'SUV' },
      ],
    },
    {
      key: 'details',
      title: 'Vehicle details',
      rows: [
        { label: 'Kilometres driven', value: '22,400 km' },
        { label: 'Owners', value: 'First owner' },
        { label: 'Colour', value: 'Polar White' },
        { label: 'Insurance', value: 'Comprehensive' },
        { label: 'Insurance valid until', value: '31 Mar 2027' },
      ],
    },
    {
      key: 'pricing',
      title: 'Pricing',
      rows: [
        { label: 'Price', value: '₹14,50,000' },
        { label: 'Negotiable', value: 'Fixed price, no hidden charges' },
      ],
    },
  ],
  description: 'Single owner, full service history at the authorised workshop.',
  issues: [],
  photography: {
    status: 'SCHEDULED',
    label: 'Shoot scheduled',
    tone: 'warn',
    note: 'Tuesday 11am at the yard',
    updatedAt: '2026-09-26T09:30:00.000Z',
    canUpdate: true,
  },
  checks: CHECKS,
  history: [
    {
      action: 'listing.submitted',
      label: 'Submitted for review',
      actor: 'Dealer',
      reason: null,
      at: '2026-09-26T09:00:00.000Z',
      atLabel: '26 Sep 2026',
    },
  ],
  actions: { canVerify: true, canRequestChanges: true, canReject: true, canApprove: false },
};

const meta = {
  title: 'Admin/ListingReview',
  component: ListingReview,
  parameters: { layout: 'fullscreen' },
  args: { detail: DETAIL },
} satisfies Meta<typeof ListingReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingReview: Story = {};

export const Resubmission: Story = {
  args: {
    detail: {
      ...DETAIL,
      listing: { ...DETAIL.listing, resubmission: true, submissionCount: 2 },
      checks: CHECKS.map((check) => ({ ...check, checked: false, checkedAt: null })),
      history: [
        ...DETAIL.history,
        {
          action: 'listing.changes_requested',
          label: 'Changes requested',
          actor: 'Dealers-Drive',
          reason: 'The variant on the car is SX, not SX(O).',
          at: '2026-09-26T11:00:00.000Z',
          atLabel: '26 Sep 2026',
        },
        {
          action: 'listing.resubmitted',
          label: 'Resubmitted after changes',
          actor: 'Dealer',
          reason: null,
          at: '2026-09-26T12:00:00.000Z',
          atLabel: '26 Sep 2026',
        },
      ],
    },
  },
};

export const ReadOnly: Story = {
  args: {
    detail: {
      ...DETAIL,
      listing: {
        ...DETAIL.listing,
        status: 'ACTIVE',
        statusLabel: 'Active',
        statusTone: 'ok',
        waitingLabel: null,
      },
      actions: { canVerify: false, canRequestChanges: false, canReject: false, canApprove: false },
    },
  },
};
