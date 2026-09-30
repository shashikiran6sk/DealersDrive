import type { AdminReactivationRow, AdminReactivationsResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ReactivationQueue } from '@/features/admin/moderation-queue';

const ROW: AdminReactivationRow = {
  id: '55555555-5555-4555-8555-555555555555',
  status: 'PENDING',
  statusLabel: 'Reactivation pending approval',
  statusTone: 'warn',
  fromStatus: 'RESERVED',
  fromStatusLabel: 'Reserved',
  toStatus: 'ACTIVE',
  toStatusLabel: 'Active',
  reason: 'The buyer backed out; the car is available again.',
  requestedAt: '2026-09-29T09:00:00.000Z',
  requestedLabel: '29 Sep 2026',
  reviewedAt: null,
  adminNote: null,
  listing: {
    id: '11111111-1111-4111-8111-111111111111',
    vehicleId: '22222222-2222-4222-8222-222222222222',
    title: '2019 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    status: 'RESERVED',
    statusLabel: 'Reserved',
    statusTone: 'warn',
    slug: '2019-honda-city-vx-katpadi-1a2b3c4d',
  },
  dealer: { id: '33333333-3333-4333-8333-333333333333', name: 'Sri Lakshmi Motors', slug: 'sri' },
  current: true,
};

const PENDING: AdminReactivationsResponse = {
  status: 'PENDING',
  data: [
    ROW,
    {
      ...ROW,
      id: '66666666-6666-4666-8666-666666666666',
      fromStatus: 'WITHDRAWN',
      fromStatusLabel: 'Withdrawn',
      reason: null,
      listing: {
        ...ROW.listing,
        id: '77777777-7777-4777-8777-777777777777',
        title: '2021 Tata Nexon XZ+',
        registrationDisplay: 'KA 01 AB 1234',
        status: 'WITHDRAWN',
        statusLabel: 'Withdrawn',
        statusTone: 'neutral',
      },
      dealer: { ...ROW.dealer, name: 'Chennai Car Bazaar' },
    },
  ],
  page: { nextCursor: null, hasMore: false },
  counts: { PENDING: 2, APPROVED: 9, REJECTED: 3, CANCELLED: 1 },
};

const meta = {
  title: 'Admin/ReactivationQueue',
  component: ReactivationQueue,
  parameters: { layout: 'padded' },
  args: {
    requests: PENDING,
    listingCounts: { PENDING_REVIEW: 14, ACTIVE: 208, RESERVED: 12, WITHDRAWN: 5, SOLD: 41 },
  },
} satisfies Meta<typeof ReactivationQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {};

export const Declined: Story = {
  args: {
    requests: {
      ...PENDING,
      status: 'REJECTED',
      data: [
        {
          ...ROW,
          status: 'REJECTED',
          statusLabel: 'Reactivation declined',
          statusTone: 'err',
          reviewedAt: '2026-09-30T09:00:00.000Z',
          adminNote: 'The car still shows as reserved with the buyer’s bank.',
        },
      ],
    },
  },
};

export const NothingWaiting: Story = {
  args: { requests: { ...PENDING, data: [], counts: {} } },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
