import type {
  CustomerEnquiry,
  CustomerSupportTicket,
  CustomerSupportTicketsResponse,
} from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SupportRequestList } from '@/features/support/support-requests';

const TICKET: CustomerSupportTicket = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'DD-1042',
  subject: 'The dealer has not called me back',
  category: 'ENQUIRY_ISSUE',
  categoryLabel: 'Problem with an enquiry',
  status: 'WAITING_FOR_CUSTOMER',
  statusLabel: 'Awaiting your reply',
  statusTone: 'warn',
  createdAt: '2026-09-30T09:02:00.000Z',
  createdLabel: '30 Sep 2026, 14:32',
  updatedAt: '2026-09-30T10:00:00.000Z',
  updatedLabel: '30 Sep 2026, 15:30',
  description: 'I enquired about the Honda City three days ago and nobody has called me yet.',
  canReply: true,
  messages: [],
  enquiry: null,
};

export const SUPPORT_TICKET = TICKET;

export const SUPPORT_ENQUIRY: CustomerEnquiry = {
  id: '22222222-2222-4222-8222-222222222222',
  status: 'SENT',
  statusLabel: 'Sent',
  statusTone: 'accent',
  message: null,
  createdAt: '2026-09-27T09:00:00.000Z',
  createdLabel: '27 Sep 2026',
  dealerName: 'Sri Lakshmi Motors',
  vehicle: { title: '2021 Honda City VX', href: null },
};

const { description: _d, canReply: _c, messages: _m, enquiry: _e, ...ROW } = TICKET;

const LIST: CustomerSupportTicketsResponse = {
  data: [
    ROW,
    {
      ...ROW,
      id: '33333333-3333-4333-8333-333333333333',
      reference: 'DD-1031',
      subject: 'Cannot change my name on my account',
      category: 'ACCOUNT_ISSUE',
      categoryLabel: 'My account',
      status: 'RESOLVED',
      statusLabel: 'Resolved',
      statusTone: 'ok',
      updatedLabel: '22 Sep 2026, 11:05',
    },
    {
      ...ROW,
      id: '44444444-4444-4444-8444-444444444444',
      reference: 'DD-1007',
      subject: 'Photos on a listing look like a different car',
      category: 'VEHICLE_LISTING_ISSUE',
      categoryLabel: 'Problem with a car or listing',
      status: 'CLOSED',
      statusLabel: 'Closed',
      statusTone: 'neutral',
      updatedLabel: '12 Sep 2026, 18:40',
    },
  ],
  page: { nextCursor: null, hasMore: false },
};

const meta = {
  title: 'Support/SupportRequestList',
  component: SupportRequestList,
  parameters: { layout: 'padded' },
  args: { tickets: LIST },
} satisfies Meta<typeof SupportRequestList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Requests: Story = {};

export const NoneYet: Story = { args: { tickets: { ...LIST, data: [] } } };

export const WithMore: Story = {
  args: { tickets: { ...LIST, page: { nextCursor: 'next', hasMore: true } } },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
