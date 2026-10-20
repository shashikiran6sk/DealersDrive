import type { CustomerSupportTicket } from '@dealers-drive/contracts/support-client';

export const supportTicket: CustomerSupportTicket = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'DD-1001',
  subject: 'Help with my account',
  category: 'ACCOUNT_ISSUE',
  categoryLabel: 'My account',
  status: 'OPEN',
  statusLabel: 'Open',
  statusTone: 'accent',
  createdAt: '2030-01-01T00:00:00.000Z',
  createdLabel: '1 Jan',
  updatedAt: '2030-01-01T00:00:00.000Z',
  updatedLabel: '1 Jan',
  description: 'Please help with my customer account.',
  canReply: true,
  canReopen: false,
  remainingMessages: 5,
  messages: [],
  enquiry: null,
};
