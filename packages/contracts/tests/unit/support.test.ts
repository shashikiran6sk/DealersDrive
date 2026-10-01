import { describe, expect, it } from 'vitest';

import {
  CreateSupportTicketInput,
  CUSTOMER_SUPPORT_STATUS_LABELS,
  ENQUIRY_RELATED_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
  SUPPORT_TICKET_TRANSITIONS,
  SupportMessageInput,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  canCustomerReply,
  canTransitionSupportTicket,
  statusAfterCustomerReply,
  supportTicketReference,
} from '../../src/support.js';

/**
 * R90 — the support request rules both ends read: the status machine, the
 * reply rule, the reference, and what a customer may send.
 */
describe('the status machine', () => {
  it('lets a closed ticket go nowhere, and nothing move to the status it already has', () => {
    expect(SUPPORT_TICKET_TRANSITIONS.CLOSED).toEqual([]);
    for (const status of SupportTicketStatus.options) {
      expect(canTransitionSupportTicket(status, status)).toBe(false);
    }
  });

  it('lets every open state be resolved or closed', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] as const) {
      expect(canTransitionSupportTicket(status, 'RESOLVED')).toBe(true);
      expect(canTransitionSupportTicket(status, 'CLOSED')).toBe(true);
    }
  });

  it('reopens a resolved ticket, but never a closed one', () => {
    expect(canTransitionSupportTicket('RESOLVED', 'OPEN')).toBe(true);
    expect(canTransitionSupportTicket('RESOLVED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionSupportTicket('CLOSED', 'OPEN')).toBe(false);
  });
});

describe('a customer reply', () => {
  it.each([
    ['OPEN', 'OPEN'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['WAITING_FOR_CUSTOMER', 'IN_PROGRESS'],
    ['RESOLVED', 'OPEN'],
    ['CLOSED', null],
  ] as const)('leaves %s as %s', (from, to) => {
    expect(statusAfterCustomerReply(from)).toBe(to);
    expect(canCustomerReply(from)).toBe(to !== null);
  });

  it('only ever lands on a status the machine allows from where it was', () => {
    for (const status of SupportTicketStatus.options) {
      const next = statusAfterCustomerReply(status);
      if (next !== null && next !== status) {
        expect(canTransitionSupportTicket(status, next)).toBe(true);
      }
    }
  });
});

describe('labels', () => {
  it('names every category, status and priority, for both audiences', () => {
    for (const category of SupportTicketCategory.options) {
      expect(SUPPORT_CATEGORY_LABELS[category]).toBeTruthy();
    }
    for (const status of SupportTicketStatus.options) {
      expect(SUPPORT_STATUS_LABELS[status]).toBeTruthy();
      expect(CUSTOMER_SUPPORT_STATUS_LABELS[status]).toBeTruthy();
      expect(SUPPORT_STATUS_TONES[status]).toBeTruthy();
    }
    for (const priority of SupportTicketPriority.options) {
      expect(SUPPORT_PRIORITY_LABELS[priority]).toBeTruthy();
      expect(SUPPORT_PRIORITY_TONES[priority]).toBeTruthy();
    }
    expect(CUSTOMER_SUPPORT_STATUS_LABELS.WAITING_FOR_CUSTOMER).toBe('Awaiting your reply');
    expect(ENQUIRY_RELATED_CATEGORIES).toContain('ENQUIRY_ISSUE');
  });

  it('formats the reference a customer quotes', () => {
    expect(supportTicketReference(1042)).toBe('DD-1042');
  });
});

describe('CreateSupportTicketInput', () => {
  const VALID = {
    category: 'ACCOUNT_ISSUE',
    subject: '  Cannot sign in  ',
    description: '  The code never arrives on my phone, I tried three times.  ',
  };

  it('trims what it takes', () => {
    expect(CreateSupportTicketInput.parse(VALID)).toEqual({
      category: 'ACCOUNT_ISSUE',
      subject: 'Cannot sign in',
      description: 'The code never arrives on my phone, I tried three times.',
    });
  });

  it.each([
    ['priority', { priority: 'URGENT' }],
    ['status', { status: 'CLOSED' }],
    ['customerId', { customerId: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7' }],
    ['dealerId', { dealerId: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7' }],
  ])('refuses %s', (_field, extra) => {
    expect(CreateSupportTicketInput.safeParse({ ...VALID, ...extra }).success).toBe(false);
  });

  it('refuses a subject or description that is only whitespace', () => {
    expect(CreateSupportTicketInput.safeParse({ ...VALID, subject: '        ' }).success).toBe(
      false,
    );
    expect(
      CreateSupportTicketInput.safeParse({ ...VALID, description: ' '.repeat(40) }).success,
    ).toBe(false);
  });
});

describe('SupportMessageInput', () => {
  it('takes a message and nothing else', () => {
    expect(SupportMessageInput.parse({ message: ' Thanks ' })).toEqual({ message: 'Thanks' });
    expect(SupportMessageInput.safeParse({ message: 'x', authorType: 'SUPPORT' }).success).toBe(
      false,
    );
  });
});
