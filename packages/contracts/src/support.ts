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

import {
  SupportMessage,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from './support-client.js';
export * from './support-client.js';

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
