import type { AdminEnquiriesResponse, AdminEnquiryRow } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EnquiryOversight } from '@/features/admin/enquiry-oversight';

const ROW: AdminEnquiryRow = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'NEW',
  statusLabel: 'New',
  statusTone: 'accent',
  messagePreview: 'Is the service history available? I can visit on Saturday morning.',
  createdAt: '2026-09-30T09:02:00.000Z',
  createdLabel: '30 Sep 2026, 14:32',
  customer: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Meera Iyer',
    phoneDisplay: '+91 98400 12345',
  },
  dealer: { id: '33333333-3333-4333-8333-333333333333', name: 'Sri Lakshmi Motors', slug: 'sri' },
  vehicle: {
    listingId: '44444444-4444-4444-8444-444444444444',
    title: '2021 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    listingStatus: 'ACTIVE',
    listingStatusLabel: 'Active',
    listingStatusTone: 'ok',
  },
};

const LIST: AdminEnquiriesResponse = {
  data: [
    ROW,
    {
      ...ROW,
      id: '55555555-5555-4555-8555-555555555555',
      status: 'CONTACTED',
      statusLabel: 'Contacted',
      statusTone: 'ok',
      messagePreview: null,
      createdLabel: '29 Sep 2026, 11:05',
      customer: { ...ROW.customer, name: 'Arjun Rao', phoneDisplay: '+91 99620 55555' },
      dealer: { ...ROW.dealer, name: 'Chennai Car Bazaar', slug: 'ccb' },
      vehicle: {
        ...ROW.vehicle,
        title: '2020 Tata Nexon XZ+',
        registrationDisplay: 'KA 01 AB 1234',
        listingStatus: 'SOLD',
        listingStatusLabel: 'Sold',
        listingStatusTone: 'neutral',
      },
    },
    {
      ...ROW,
      id: '66666666-6666-4666-8666-666666666666',
      status: 'SPAM',
      statusLabel: 'Spam',
      statusTone: 'err',
      messagePreview: 'Call me',
      createdLabel: '28 Sep 2026, 20:41',
      customer: { ...ROW.customer, name: 'Customer', phoneDisplay: null },
    },
  ],
  page: { nextCursor: 'next', hasMore: true },
  counts: { ALL: 214, NEW: 37, CONTACTED: 120, CLOSED: 51, SPAM: 6 },
  dealer: null,
};

const meta = {
  title: 'Admin/EnquiryOversight',
  component: EnquiryOversight,
  parameters: { layout: 'padded' },
  args: { enquiries: LIST, filters: {} },
} satisfies Meta<typeof EnquiryOversight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const FilteredByDealerAndSearch: Story = {
  args: {
    enquiries: { ...LIST, data: [ROW], dealer: { slug: 'sri', name: 'Sri Lakshmi Motors' } },
    filters: { status: 'NEW', q: 'city', dealer: 'sri', from: '2026-09-01', to: '2026-09-30' },
  },
};

export const UnknownDealer: Story = {
  args: {
    enquiries: { ...LIST, data: [], dealer: { slug: 'gone', name: null } },
    filters: { dealer: 'gone' },
  },
};

export const NoneAtAll: Story = {
  args: {
    enquiries: {
      ...LIST,
      data: [],
      page: { nextCursor: null, hasMore: false },
      counts: { ALL: 0, NEW: 0, CONTACTED: 0, CLOSED: 0, SPAM: 0 },
    },
  },
};

export const NoneMatching: Story = {
  args: {
    enquiries: { ...LIST, data: [], page: { nextCursor: null, hasMore: false } },
    filters: { q: 'nobody' },
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
