import type { AdminListingsResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ModerationQueue } from '@/features/admin/moderation-queue';

const ROW: AdminListingsResponse['data'][number] = {
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
};

const QUEUE: AdminListingsResponse = {
  status: 'PENDING_REVIEW',
  data: [
    ROW,
    {
      ...ROW,
      id: '44444444-4444-4444-8444-444444444444',
      title: '2021 Tata Nexon XZ+',
      registrationDisplay: 'TN 09 BX 0001',
      dealer: { ...ROW.dealer, name: 'Chennai Car Bazaar' },
      location: 'Chennai',
      waitingLabel: '2 days ago',
      resubmission: true,
    },
  ],
  page: { nextCursor: 'next', hasMore: true },
  counts: { PENDING_REVIEW: 14, CHANGES_REQUESTED: 3, ACTIVE: 208, REJECTED: 6, SOLD: 41 },
};

const meta = {
  title: 'Admin/ModerationQueue',
  component: ModerationQueue,
  parameters: { layout: 'padded' },
  args: { listings: QUEUE },
} satisfies Meta<typeof ModerationQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {};

export const QueueClear: Story = {
  args: {
    listings: { ...QUEUE, data: [], page: { nextCursor: null, hasMore: false }, counts: {} },
  },
};

export const NothingMatches: Story = {
  args: { q: 'zzz', listings: { ...QUEUE, data: [], page: { nextCursor: null, hasMore: false } } },
};
