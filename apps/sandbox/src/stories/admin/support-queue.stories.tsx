import type { AdminSupportTicketRow, AdminSupportTicketsResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SupportQueue } from '@/features/admin/support-queue';

export const SUPPORT_ME = {
  id: '77777777-7777-4777-8777-777777777777',
  label: 'Priya (ops)',
  email: 'priya@dealers-drive.test',
};
const COLLEAGUE = {
  id: '88888888-8888-4888-8888-888888888888',
  label: 'Arun',
  email: 'arun@dealers-drive.test',
};

export const SUPPORT_ROW: AdminSupportTicketRow = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'DD-1042',
  subject: 'The dealer has not called me back',
  category: 'ENQUIRY_ISSUE',
  categoryLabel: 'Problem with an enquiry',
  status: 'OPEN',
  statusLabel: 'Open',
  statusTone: 'accent',
  priority: 'HIGH',
  priorityLabel: 'High',
  priorityTone: 'warn',
  customer: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Meera Iyer',
    phoneDisplay: '+91 98400 10001',
  },
  context: {
    enquiryId: '33333333-3333-4333-8333-333333333333',
    vehicleTitle: '2021 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    dealerName: 'Sri Lakshmi Motors',
  },
  assignee: SUPPORT_ME,
  createdAt: '2026-09-30T09:02:00.000Z',
  createdLabel: '30 Sep 2026, 14:32',
  updatedAt: '2026-09-30T10:00:00.000Z',
  updatedLabel: '30 Sep 2026, 15:30',
};

const QUEUE: AdminSupportTicketsResponse = {
  data: [
    SUPPORT_ROW,
    {
      ...SUPPORT_ROW,
      id: '44444444-4444-4444-8444-444444444444',
      reference: 'DD-1041',
      subject: 'Saved cars page does not load on my phone',
      category: 'TECHNICAL_ISSUE',
      categoryLabel: 'Something isn’t working',
      status: 'WAITING_FOR_CUSTOMER',
      statusLabel: 'Waiting for customer',
      statusTone: 'warn',
      priority: 'NORMAL',
      priorityLabel: 'Normal',
      priorityTone: 'neutral',
      context: null,
      assignee: COLLEAGUE,
      customer: { ...SUPPORT_ROW.customer, name: 'Arjun Rao', phoneDisplay: '+91 98400 10002' },
    },
    {
      ...SUPPORT_ROW,
      id: '55555555-5555-4555-8555-555555555555',
      reference: 'DD-1039',
      subject: 'Please correct the spelling of my name',
      category: 'ACCOUNT_ISSUE',
      categoryLabel: 'My account',
      status: 'RESOLVED',
      statusLabel: 'Resolved',
      statusTone: 'ok',
      priority: 'LOW',
      priorityLabel: 'Low',
      priorityTone: 'neutral',
      context: null,
      assignee: null,
    },
  ],
  page: { nextCursor: 'next', hasMore: true },
  counts: { ALL: 27, OPEN: 9, IN_PROGRESS: 6, WAITING_FOR_CUSTOMER: 4, RESOLVED: 5, CLOSED: 3 },
  assignees: [SUPPORT_ME, COLLEAGUE],
};

const meta = {
  title: 'Admin/SupportQueue',
  component: SupportQueue,
  parameters: { layout: 'padded' },
  args: { tickets: QUEUE, filters: {} },
} satisfies Meta<typeof SupportQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Queue: Story = {};

export const Filtered: Story = {
  args: {
    tickets: { ...QUEUE, data: [SUPPORT_ROW], page: { nextCursor: null, hasMore: false } },
    filters: { status: 'OPEN', priority: 'HIGH', assignee: 'me', q: 'honda' },
  },
};

export const NoneAtAll: Story = {
  args: {
    tickets: {
      ...QUEUE,
      data: [],
      page: { nextCursor: null, hasMore: false },
      counts: { ALL: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 },
    },
  },
};

export const NoneMatching: Story = {
  args: {
    tickets: { ...QUEUE, data: [], page: { nextCursor: null, hasMore: false } },
    filters: { q: 'nobody' },
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
