import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import { AdminEnquiryDetail } from './enquiry.js';
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

/**
 * ── R91 · the admin's support ticket workspace ─────────────────────────────
 *
 * The same tickets, managed. Everything here is behind the admin guard and
 * `admin:support:manage`. Internal notes exist only in these shapes; no
 * customer response has a field for them.
 */

/** A private note on a ticket. Never returned by a customer route. */
export const SUPPORT_NOTE_MAX = 5000;

export const SupportNoteInput = z
  .object({
    note: z
      .string()
      .trim()
      .min(1, 'Write a note first.')
      .max(
        SUPPORT_NOTE_MAX,
        `Keep the note under ${SUPPORT_NOTE_MAX.toLocaleString('en-IN')} characters.`,
      ),
  })
  .strict();
export type SupportNoteInput = z.infer<typeof SupportNoteInput>;

/**
 * `PATCH /v1/admin/support/tickets/:id` — status, priority and assignee, any
 * of them, at least one. A status move must be in
 * `SUPPORT_TICKET_TRANSITIONS`; `assignedAdminId: null` unassigns.
 */
export const UpdateSupportTicketInput = z
  .object({
    status: SupportTicketStatus.optional(),
    priority: SupportTicketPriority.optional(),
    assignedAdminId: Uuid.nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.status !== undefined ||
      input.priority !== undefined ||
      input.assignedAdminId !== undefined,
    { message: 'Change the status, the priority or the assignee.' },
  );
export type UpdateSupportTicketInput = z.infer<typeof UpdateSupportTicketInput>;

/**
 * `GET /v1/admin/support/tickets`. `assignee` is `me`, `unassigned` or an
 * admin's user id. `q` matches the reference (`DD-1042` or `1042`), the
 * customer's name or mobile, and the dealership or car of the enquiry a
 * ticket is about.
 */
export const AdminSupportTicketQuery = z
  .object({
    status: SupportTicketStatus.optional(),
    category: SupportTicketCategory.optional(),
    priority: SupportTicketPriority.optional(),
    assignee: z.union([z.literal('me'), z.literal('unassigned'), Uuid]).optional(),
    q: z.string().trim().max(120).optional(),
    from: z.iso.date('Enter a date as YYYY-MM-DD.').optional(),
    to: z.iso.date('Enter a date as YYYY-MM-DD.').optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type AdminSupportTicketQuery = z.infer<typeof AdminSupportTicketQuery>;

/** An operator a ticket can be assigned to. */
export const SupportAssignee = z.object({
  id: Uuid,
  label: z.string(),
  email: z.string(),
});
export type SupportAssignee = z.infer<typeof SupportAssignee>;

/** What a ticket is about, when it references an enquiry — one line for a list. */
export const SupportTicketContext = z.object({
  enquiryId: Uuid,
  vehicleTitle: z.string(),
  registrationDisplay: z.string(),
  dealerName: z.string(),
});
export type SupportTicketContext = z.infer<typeof SupportTicketContext>;

export const AdminSupportTicketRow = z.object({
  id: Uuid,
  reference: z.string(),
  subject: z.string(),
  category: SupportTicketCategory,
  categoryLabel: z.string(),
  status: SupportTicketStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  priority: SupportTicketPriority,
  priorityLabel: z.string(),
  priorityTone: StatusTone,
  customer: z.object({ id: Uuid, name: z.string(), phoneDisplay: z.string().nullable() }),
  context: SupportTicketContext.nullable(),
  assignee: SupportAssignee.nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  updatedAt: z.string(),
  updatedLabel: z.string(),
});
export type AdminSupportTicketRow = z.infer<typeof AdminSupportTicketRow>;

export const SupportTicketCounts = z.object({
  ALL: z.number().int(),
  OPEN: z.number().int(),
  IN_PROGRESS: z.number().int(),
  WAITING_FOR_CUSTOMER: z.number().int(),
  RESOLVED: z.number().int(),
  CLOSED: z.number().int(),
});
export type SupportTicketCounts = z.infer<typeof SupportTicketCounts>;

/** `counts` is per status under every filter except `status`. */
export const AdminSupportTicketsResponse = z.object({
  data: z.array(AdminSupportTicketRow),
  page: CursorPage,
  counts: SupportTicketCounts,
  assignees: z.array(SupportAssignee),
});
export type AdminSupportTicketsResponse = z.infer<typeof AdminSupportTicketsResponse>;

/** One message as the console shows it — which customer, or which operator. */
export const AdminSupportMessage = SupportMessage.extend({ authorName: z.string() });
export type AdminSupportMessage = z.infer<typeof AdminSupportMessage>;

export const SupportInternalNote = z.object({
  id: Uuid,
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
  createdLabel: z.string(),
});
export type SupportInternalNote = z.infer<typeof SupportInternalNote>;

export const SupportHistoryEntry = z.object({
  action: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  actor: z.string(),
  at: z.string(),
  atLabel: z.string(),
});
export type SupportHistoryEntry = z.infer<typeof SupportHistoryEntry>;

/**
 * `GET /v1/admin/support/tickets/:id` — the operational workspace. The
 * related enquiry, its car and its dealership are read through the ticket's
 * one reference, never stored on it. `transitions` is what the status may
 * move to now, from `SUPPORT_TICKET_TRANSITIONS`.
 */
export const AdminSupportTicketDetail = AdminSupportTicketRow.extend({
  description: z.string(),
  resolvedLabel: z.string().nullable(),
  closedLabel: z.string().nullable(),
  canReply: z.boolean(),
  transitions: z.array(SupportTicketStatus),
  customer: z.object({
    id: Uuid,
    name: z.string(),
    phone: z.string().nullable(),
    phoneDisplay: z.string().nullable(),
    memberSinceLabel: z.string(),
    ticketCount: z.number().int(),
  }),
  enquiry: z
    .object({
      id: Uuid,
      statusLabel: z.string(),
      customerStatusLabel: z.string(),
      statusTone: StatusTone,
      sentLabel: z.string(),
      message: z.string().nullable(),
      adminHref: z.string(),
    })
    .nullable(),
  vehicle: AdminEnquiryDetail.shape.vehicle.nullable(),
  dealer: z
    .object({
      id: Uuid,
      name: z.string(),
      statusLabel: z.string(),
      statusTone: StatusTone,
      phoneDisplay: z.string().nullable(),
      adminHref: z.string(),
    })
    .nullable(),
  messages: z.array(AdminSupportMessage),
  notes: z.array(SupportInternalNote),
  history: z.array(SupportHistoryEntry),
  assignees: z.array(SupportAssignee),
});
export type AdminSupportTicketDetail = z.infer<typeof AdminSupportTicketDetail>;

/** A ticket referencing an enquiry, as the enquiry's admin page lists it. */
export const EnquirySupportTicket = z.object({
  id: Uuid,
  reference: z.string(),
  subject: z.string(),
  statusLabel: z.string(),
  statusTone: StatusTone,
  createdLabel: z.string(),
});
export type EnquirySupportTicket = z.infer<typeof EnquirySupportTicket>;
