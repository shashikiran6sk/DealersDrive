import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SupportTicketWorkspace } from '@/features/admin/support-ticket';

import { SUPPORT_ME, SUPPORT_ROW } from './support-queue.stories';

const TICKET: AdminSupportTicketDetail = {
  ...SUPPORT_ROW,
  description:
    'I enquired about this car three days ago. Nobody has called me yet and the car is still listed.',
  resolvedLabel: null,
  closedLabel: null,
  canReply: true,
  transitions: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
  customer: {
    id: SUPPORT_ROW.customer.id,
    name: 'Meera Iyer',
    phone: '+919840010001',
    phoneDisplay: '+91 98400 10001',
    memberSinceLabel: '20 Sep 2026',
    ticketCount: 3,
  },
  enquiry: {
    id: '33333333-3333-4333-8333-333333333333',
    statusLabel: 'Contacted',
    customerStatusLabel: 'Contacted',
    statusTone: 'ok',
    sentLabel: '27 Sep 2026, 10:00',
    message: 'Is the service history available?',
    adminHref: '/admin/enquiries/33333333-3333-4333-8333-333333333333',
  },
  vehicle: {
    listingId: '66666666-6666-4666-8666-666666666666',
    title: '2021 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    listingStatus: 'SOLD',
    listingStatusLabel: 'Sold',
    listingStatusTone: 'neutral',
    image: null,
    publicHref: null,
    adminHref: '/admin/listings/66666666-6666-4666-8666-666666666666',
  },
  dealer: {
    id: '99999999-9999-4999-8999-999999999990',
    name: 'Sri Lakshmi Motors',
    statusLabel: 'Active',
    statusTone: 'ok',
    phoneDisplay: '+91 94430 00000',
    adminHref: '/admin/dealers/99999999-9999-4999-8999-999999999990',
  },
  messages: [
    {
      id: '99999999-9999-4999-8999-999999999991',
      author: 'SUPPORT',
      authorLabel: 'Dealers-Drive support',
      authorName: 'Priya (ops)',
      body: 'Thanks for telling us. We have asked the dealership to call you today.',
      createdAt: '2026-09-30T10:00:00.000Z',
      createdLabel: '30 Sep 2026, 15:30',
    },
    {
      id: '99999999-9999-4999-8999-999999999992',
      author: 'CUSTOMER',
      authorLabel: 'Meera Iyer',
      authorName: 'Meera Iyer',
      body: 'Thank you, I will wait for their call.',
      createdAt: '2026-09-30T11:00:00.000Z',
      createdLabel: '30 Sep 2026, 16:30',
    },
  ],
  notes: [
    {
      id: '99999999-9999-4999-8999-999999999993',
      authorName: 'Priya (ops)',
      body: 'Called the dealer at 14:32. They say they tried the customer twice.',
      createdAt: '2026-09-30T09:30:00.000Z',
      createdLabel: '30 Sep 2026, 15:00',
    },
  ],
  history: [
    {
      action: 'support_ticket.created',
      label: 'Request created',
      detail: null,
      actor: 'Customer',
      at: '2026-09-30T09:02:00.000Z',
      atLabel: '30 Sep 2026, 14:32',
    },
    {
      action: 'support_ticket.priority_changed',
      label: 'Priority changed',
      detail: 'Normal → High',
      actor: 'Dealers-Drive · Priya (ops)',
      at: '2026-09-30T09:10:00.000Z',
      atLabel: '30 Sep 2026, 14:40',
    },
    {
      action: 'support_ticket.assigned',
      label: 'Assigned',
      detail: 'to Priya (ops)',
      actor: 'Dealers-Drive · Priya (ops)',
      at: '2026-09-30T09:11:00.000Z',
      atLabel: '30 Sep 2026, 14:41',
    },
  ],
  assignees: [
    SUPPORT_ME,
    { id: '88888888-8888-4888-8888-888888888888', label: 'Arun', email: 'arun@dealers-drive.test' },
  ],
};

const meta = {
  title: 'Admin/SupportTicketWorkspace',
  component: SupportTicketWorkspace,
  parameters: { layout: 'fullscreen' },
  args: { ticket: TICKET, viewerId: SUPPORT_ME.id },
} satisfies Meta<typeof SupportTicketWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Working: Story = {};

export const Unassigned: Story = { args: { ticket: { ...TICKET, assignee: null } } };

export const NoEnquiry: Story = {
  args: { ticket: { ...TICKET, enquiry: null, vehicle: null, dealer: null, notes: [] } },
};

export const Closed: Story = {
  args: {
    ticket: {
      ...TICKET,
      status: 'CLOSED',
      statusLabel: 'Closed',
      statusTone: 'neutral',
      canReply: false,
      transitions: [],
      closedLabel: '01 Oct 2026, 10:00',
    },
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
