import type { DealerInventoryResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InventoryView } from '@/features/dealer/inventory';

const ROWS: DealerInventoryResponse['data'] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: '2023 Hyundai Creta SX(O)',
    registrationDisplay: 'KA 01 AB 1234',
    summary: 'Petrol · Automatic · 22,400 km',
    priceLabel: '₹14,50,000',
    status: 'PENDING_REVIEW',
    statusLabel: 'Pending review',
    statusTone: 'warn',
    reason: null,
    complete: true,
    updatedAt: '2026-09-20T00:00:00.000Z',
    updatedLabel: '20 Sep 2026',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: '2021 Tata Nexon XZ+',
    registrationDisplay: 'TN 09 BX 0001',
    summary: 'Diesel · Manual · 48,000 km',
    priceLabel: '₹8,90,000',
    status: 'CHANGES_REQUESTED',
    statusLabel: 'Changes requested',
    statusTone: 'warn',
    reason: 'The odometer reading does not match what our photographer saw.',
    complete: true,
    updatedAt: '2026-09-19T00:00:00.000Z',
    updatedLabel: '19 Sep 2026',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: '2020 Maruti Suzuki Swift VXi',
    registrationDisplay: 'KA 05 MN 4411',
    summary: 'Petrol · Manual · 31,200 km',
    priceLabel: '₹5,75,000',
    status: 'ACTIVE',
    statusLabel: 'Active',
    statusTone: 'ok',
    reason: null,
    complete: true,
    updatedAt: '2026-09-15T00:00:00.000Z',
    updatedLabel: '15 Sep 2026',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'KA 03 ZZ 0909',
    registrationDisplay: 'KA 03 ZZ 0909',
    summary: '',
    priceLabel: null,
    status: 'DRAFT',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    reason: null,
    complete: false,
    updatedAt: '2026-09-14T00:00:00.000Z',
    updatedLabel: '14 Sep 2026',
  },
];

const FULL: DealerInventoryResponse = {
  data: ROWS,
  page: { nextCursor: 'next', hasMore: true },
  counts: { ALL: 12, DRAFT: 1, PENDING_REVIEW: 1, CHANGES_REQUESTED: 1, ACTIVE: 7, SOLD: 2 },
};

const meta = {
  title: 'Dealer/InventoryView',
  component: InventoryView,
  parameters: { layout: 'padded' },
  args: { inventory: FULL },
} satisfies Meta<typeof InventoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryStatus: Story = {};

export const FilteredToChanges: Story = {
  args: {
    status: 'CHANGES_REQUESTED',
    inventory: { ...FULL, data: [ROWS[1]!], page: { nextCursor: null, hasMore: false } },
  },
};

export const Empty: Story = {
  args: { inventory: { data: [], page: { nextCursor: null, hasMore: false }, counts: { ALL: 0 } } },
};

export const NothingMatches: Story = {
  args: { q: 'zzz', inventory: { ...FULL, data: [], page: { nextCursor: null, hasMore: false } } },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
