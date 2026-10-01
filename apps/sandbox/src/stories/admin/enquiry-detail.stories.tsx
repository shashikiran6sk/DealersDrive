import type { AdminEnquiryDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EnquiryDetail } from '@/features/admin/enquiry-detail';

const ENQUIRY: AdminEnquiryDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'SPAM',
  statusLabel: 'Spam',
  statusTone: 'err',
  customerStatusLabel: 'Closed',
  message: 'Is the service history available?\nI can visit on Saturday morning.',
  createdAt: '2026-09-30T09:02:00.000Z',
  createdLabel: '30 Sep 2026, 14:32',
  contactedLabel: '30 Sep 2026, 15:10',
  closedLabel: null,
  customer: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Meera Iyer',
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
    phoneVerified: true,
    memberSinceLabel: '20 Sep 2026',
  },
  dealer: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Sri Lakshmi Motors',
    slug: 'sri',
    statusLabel: 'Active',
    statusTone: 'ok',
    location: 'Katpadi, Vellore',
    phoneDisplay: '+91 94430 00000',
    adminHref: '/admin/dealers/33333333-3333-4333-8333-333333333333',
  },
  vehicle: {
    listingId: '44444444-4444-4444-8444-444444444444',
    title: '2021 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    listingStatus: 'SOLD',
    listingStatusLabel: 'Sold',
    listingStatusTone: 'neutral',
    image: {
      url: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=640',
      alt: 'Photograph of the 2021 Honda City VX',
    },
    publicHref: null,
    adminHref: '/admin/listings/44444444-4444-4444-8444-444444444444',
  },
  history: [
    {
      action: 'enquiry.created',
      label: 'Enquiry sent',
      actor: 'Customer',
      fromStatus: null,
      toStatus: 'NEW',
      at: '2026-09-30T09:02:00.000Z',
      atLabel: '30 Sep 2026, 14:32',
    },
    {
      action: 'enquiry.contacted',
      label: 'Marked contacted',
      actor: 'Dealer',
      fromStatus: 'NEW',
      toStatus: 'CONTACTED',
      at: '2026-09-30T09:40:00.000Z',
      atLabel: '30 Sep 2026, 15:10',
    },
    {
      action: 'enquiry.spam',
      label: 'Marked as spam',
      actor: 'Dealer',
      fromStatus: 'CONTACTED',
      toStatus: 'SPAM',
      at: '2026-09-30T10:00:00.000Z',
      atLabel: '30 Sep 2026, 15:30',
    },
  ],
};

const meta = {
  title: 'Admin/EnquiryDetail',
  component: EnquiryDetail,
  parameters: { layout: 'fullscreen' },
  args: { enquiry: ENQUIRY },
} satisfies Meta<typeof EnquiryDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpamSoldCarWithPhotograph: Story = {};

export const NothingOnFile: Story = {
  args: {
    enquiry: {
      ...ENQUIRY,
      status: 'NEW',
      statusLabel: 'New',
      statusTone: 'accent',
      customerStatusLabel: 'Sent',
      message: null,
      contactedLabel: null,
      history: [],
      customer: { ...ENQUIRY.customer, phone: null, phoneDisplay: null, phoneVerified: false },
      dealer: { ...ENQUIRY.dealer, location: null, phoneDisplay: null },
      vehicle: { ...ENQUIRY.vehicle, image: null, publicHref: '/car/2021-honda-city-vx' },
    },
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
