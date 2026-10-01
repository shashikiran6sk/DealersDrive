import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import { StatusTone } from './enums.js';

/**
 * ── R90 · support requests ──────────────────────────────────────────────────
 *
 * A customer asking Dealers-Drive itself for help — a question, a problem with
 * their account, or a dispute with a dealership. Deliberately a domain of its
 * own and not an enquiry: an enquiry is a customer talking to a dealership,
 * and a support request is a customer talking to us. The two meet only in an
 * optional reference from a request to one of the customer's own enquiries,
 * through which the dealership and the car are reached rather than copied.
 *
 * Customer-facing words are "support request"; the admin console says
 * "support ticket". The model is the same.
 */

export const SupportTicketCategory = z.enum([
  'DEALER_ISSUE',
  'VEHICLE_LISTING_ISSUE',
  'ENQUIRY_ISSUE',
  'ACCOUNT_ISSUE',
  'TECHNICAL_ISSUE',
  'GENERAL_QUESTION',
  'OTHER',
]);
export type SupportTicketCategory = z.infer<typeof SupportTicketCategory>;

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  DEALER_ISSUE: 'Problem with a dealer',
  VEHICLE_LISTING_ISSUE: 'Problem with a car or listing',
  ENQUIRY_ISSUE: 'Problem with an enquiry',
  ACCOUNT_ISSUE: 'My account',
  TECHNICAL_ISSUE: 'Something isn’t working',
  GENERAL_QUESTION: 'General question',
  OTHER: 'Something else',
};

/**
 * The categories where pointing at one of the customer's enquiries is the
 * useful context — the form offers the enquiry picker for these. Any category
 * may carry one; these are the ones that ask.
 */
export const ENQUIRY_RELATED_CATEGORIES: readonly SupportTicketCategory[] = [
  'ENQUIRY_ISSUE',
  'DEALER_ISSUE',
  'VEHICLE_LISTING_ISSUE',
];

export const SupportTicketStatus = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
  'CLOSED',
]);
export type SupportTicketStatus = z.infer<typeof SupportTicketStatus>;

export const SupportTicketPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export type SupportTicketPriority = z.infer<typeof SupportTicketPriority>;

/**
 * **Every move a ticket may make, in one table.** The API refuses anything
 * not listed with `409 SUPPORT_TICKET_TRANSITION`, and the console offers only
 * what is listed, so the rule has exactly one definition.
 *
 * `CLOSED` is final: a closed ticket is history, and a customer with more to
 * say opens a new request. `RESOLVED` is not — it can be reopened, by support
 * or by the customer replying (see `statusAfterCustomerReply`).
 */
export const SUPPORT_TICKET_TRANSITIONS: Record<
  SupportTicketStatus,
  readonly SupportTicketStatus[]
> = {
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function canTransitionSupportTicket(
  from: SupportTicketStatus,
  to: SupportTicketStatus,
): boolean {
  return SUPPORT_TICKET_TRANSITIONS[from].includes(to);
}

/** A customer may write on any ticket that is not closed. */
export function canCustomerReply(status: SupportTicketStatus): boolean {
  return status !== 'CLOSED';
}

/**
 * Where a customer's reply leaves the ticket. Waiting on the customer, their
 * answer hands it back to support; resolved, a reply means it was not, so it
 * reopens. Open or in progress, nothing changes. Closed takes no reply at all.
 */
export function statusAfterCustomerReply(status: SupportTicketStatus): SupportTicketStatus | null {
  if (status === 'CLOSED') return null;
  if (status === 'WAITING_FOR_CUSTOMER') return 'IN_PROGRESS';
  if (status === 'RESOLVED') return 'OPEN';
  return status;
}

/** The labels the console uses. */
export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CUSTOMER: 'Waiting for customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** The labels the customer reads — the same states, said to them. */
export const CUSTOMER_SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CUSTOMER: 'Awaiting your reply',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const SUPPORT_STATUS_TONES: Record<SupportTicketStatus, StatusTone> = {
  OPEN: 'accent',
  IN_PROGRESS: 'warn',
  WAITING_FOR_CUSTOMER: 'warn',
  RESOLVED: 'ok',
  CLOSED: 'neutral',
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const SUPPORT_PRIORITY_TONES: Record<SupportTicketPriority, StatusTone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  HIGH: 'warn',
  URGENT: 'err',
};

/** `DD-1042` — the reference a customer quotes. Never the row id. */
export function supportTicketReference(number: number): string {
  return `DD-${String(number)}`;
}

export const SUPPORT_SUBJECT_MIN = 5;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_DESCRIPTION_MIN = 20;
export const SUPPORT_DESCRIPTION_MAX = 5000;
export const SUPPORT_MESSAGE_MAX = 5000;

export const SupportSubject = z
  .string()
  .trim()
  .min(
    SUPPORT_SUBJECT_MIN,
    `Give your request a subject of at least ${String(SUPPORT_SUBJECT_MIN)} characters.`,
  )
  .max(SUPPORT_SUBJECT_MAX, `Keep the subject under ${String(SUPPORT_SUBJECT_MAX)} characters.`);

export const SupportDescription = z
  .string()
  .trim()
  .min(
    SUPPORT_DESCRIPTION_MIN,
    `Tell us a little more — at least ${String(SUPPORT_DESCRIPTION_MIN)} characters.`,
  )
  .max(
    SUPPORT_DESCRIPTION_MAX,
    `Keep the description under ${SUPPORT_DESCRIPTION_MAX.toLocaleString('en-IN')} characters.`,
  );

export const SupportMessageBody = z
  .string()
  .trim()
  .min(1, 'Write a message first.')
  .max(
    SUPPORT_MESSAGE_MAX,
    `Keep the message under ${SUPPORT_MESSAGE_MAX.toLocaleString('en-IN')} characters.`,
  );

/**
 * `POST /v1/support/tickets`.
 *
 * Who is asking is the session; there is no customer field. `enquiryId` is a
 * *reference* the server checks belongs to that customer — an id that is not
 * one of theirs is refused exactly as one that does not exist. There is no
 * dealer, listing, status or priority here: the dealership and the car come
 * through the enquiry, a new request is always `OPEN`, and priority is
 * support's to set.
 */
export const CreateSupportTicketInput = z
  .object({
    category: SupportTicketCategory,
    subject: SupportSubject,
    description: SupportDescription,
    enquiryId: Uuid.optional(),
  })
  .strict();
export type CreateSupportTicketInput = z.infer<typeof CreateSupportTicketInput>;

/** `POST /v1/support/tickets/:id/messages` — a reply in the conversation. */
export const SupportMessageInput = z.object({ message: SupportMessageBody }).strict();
export type SupportMessageInput = z.infer<typeof SupportMessageInput>;

/** `GET /v1/support/tickets` — most recently active first. */
export const CustomerSupportTicketQuery = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type CustomerSupportTicketQuery = z.infer<typeof CustomerSupportTicketQuery>;

export const SupportTicketRow = z.object({
  id: Uuid,
  reference: z.string(),
  subject: z.string(),
  category: SupportTicketCategory,
  categoryLabel: z.string(),
  status: SupportTicketStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  createdAt: z.string(),
  createdLabel: z.string(),
  updatedAt: z.string(),
  updatedLabel: z.string(),
});
export type SupportTicketRow = z.infer<typeof SupportTicketRow>;

export const CustomerSupportTicketsResponse = z.object({
  data: z.array(SupportTicketRow),
  page: CursorPage,
});
export type CustomerSupportTicketsResponse = z.infer<typeof CustomerSupportTicketsResponse>;

/**
 * One message in a ticket's public conversation. `author` says which side
 * wrote it and nothing more: the customer never learns which operator
 * answered — every support reply reads as Dealers-Drive support.
 */
export const SupportMessage = z.object({
  id: Uuid,
  author: z.enum(['CUSTOMER', 'SUPPORT']),
  authorLabel: z.string(),
  body: z.string(),
  createdAt: z.string(),
  createdLabel: z.string(),
});
export type SupportMessage = z.infer<typeof SupportMessage>;

/**
 * The enquiry a request is about, as the customer may see it — what their own
 * My enquiries page already shows them, and nothing the dealership keeps.
 */
export const CustomerSupportEnquiry = z.object({
  id: Uuid,
  vehicleTitle: z.string(),
  dealerName: z.string(),
  statusLabel: z.string(),
  sentLabel: z.string(),
  vehicleHref: z.string().nullable(),
});
export type CustomerSupportEnquiry = z.infer<typeof CustomerSupportEnquiry>;

/**
 * `GET /v1/support/tickets/:id` — the customer's own ticket. There is no
 * internal note, priority, assignee or audit detail anywhere in this shape:
 * what support keeps to itself is not filtered out of this response, it was
 * never selected for it.
 */
export const CustomerSupportTicket = SupportTicketRow.extend({
  description: z.string(),
  canReply: z.boolean(),
  messages: z.array(SupportMessage),
  enquiry: CustomerSupportEnquiry.nullable(),
});
export type CustomerSupportTicket = z.infer<typeof CustomerSupportTicket>;
