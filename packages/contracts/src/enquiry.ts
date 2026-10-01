import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import { EnquiryStatus, ListingStatus, StatusTone } from './enums.js';

/**
 * ── R64 · enquiries come from signed-in customers ──────────────────────────
 *
 * Revises F088. The baseline's enquiry was a form a buyer typed their name and
 * number into; a dealer would ring whatever was typed. Now an enquiry is sent
 * by a customer who proved their handset (R62), and the name and number the
 * dealer receives are **derived from that account** — the body carries neither.
 *
 * What a customer sends is which car, and optionally a line of text. Who they
 * are comes from the session; which dealership receives it comes from the
 * listing. So this input has no `dealerId`, no `customerPhone`, no
 * `customerName` — and, being `.strict()`, sending one is a 400 that names it.
 */

/*
 * The status is `EnquiryStatus` in `enums.ts` — NEW, CONTACTED, CLOSED and
 * SPAM — kept from the baseline rather than redefined. The brief's minimum is
 * the first three; SPAM stays because DESIGN-SPEC §3.15 draws it as an inbox
 * tab and it is the dealer's answer to the abuse this phase guards against.
 */

/**
 * The optional message. Trimmed, and an empty or whitespace-only message is
 * no message at all rather than a blank line on the dealer's screen — a
 * customer who only wants a call back should not have to invent filler text.
 */
export const EnquiryMessage = z
  .string()
  .trim()
  .max(1000, 'Keep your message under 1,000 characters.')
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

/**
 * `POST /v1/enquiries`.
 *
 * `listingSlug` is the listing's public address — the only identifier a buyer
 * ever sees (F075) — used as a reference, never written. It is not a slug the
 * caller chooses, which is what the package's rule 2 exists to prevent.
 */
export const CreateEnquiryInput = z
  .object({
    listingSlug: z.string().trim().min(1, 'Choose a car to enquire about.').max(200),
    message: EnquiryMessage,
  })
  .strict();
export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInput>;

/** What the customer is told once the dealership has their enquiry. */
export const EnquiryReceipt = z.object({
  id: z.string(),
  status: EnquiryStatus,
  createdAt: z.string(),
  /** The dealership that received it — the name only, as on the VDP. */
  dealerName: z.string(),
  vehicleTitle: z.string(),
});
export type EnquiryReceipt = z.infer<typeof EnquiryReceipt>;

/**
 * ── R66 · the dealership's inbox ──────────────────────────────────────────
 *
 * Revises F091. Every read and write here is scoped to the dealership in the
 * session; nothing in these schemas names one. Another dealership's enquiry is
 * a 404, never a 403, so an id cannot be probed for existence.
 */

/**
 * `GET /v1/dealer/enquiries`. `status` filters to one inbox tab; without it,
 * every enquiry. Newest first, cursor-paginated.
 */
export const DealerEnquiryQuery = z
  .object({
    status: EnquiryStatus.optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type DealerEnquiryQuery = z.infer<typeof DealerEnquiryQuery>;

/**
 * The count in each inbox tab, and `ALL`. Counted from `enquiries`, never
 * stored, and unaffected by the filter — switching tab never empties the bar.
 */
export const DealerEnquiryCounts = z.object({
  ALL: z.number().int(),
  NEW: z.number().int(),
  CONTACTED: z.number().int(),
  CLOSED: z.number().int(),
  SPAM: z.number().int(),
});
export type DealerEnquiryCounts = z.infer<typeof DealerEnquiryCounts>;

/**
 * One enquiry as the dealership sees it.
 *
 * `customer` is read from the customer's account when the inbox renders — the
 * current name and the proved number (R39), never text somebody typed. `phone`
 * is null only for an account whose number has since been released, and then
 * there is no Call button. `vehicle.href` is the public page while the car is
 * on the marketplace, and null once it is not.
 */
export const DealerEnquiry = z.object({
  id: Uuid,
  status: EnquiryStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  message: z.string().nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  timeAgoLabel: z.string(),
  contactedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  customer: z.object({
    name: z.string(),
    initials: z.string(),
    phone: z.string().nullable(),
    phoneDisplay: z.string().nullable(),
    callHref: z.string().nullable(),
  }),
  vehicle: z.object({
    id: Uuid,
    title: z.string(),
    registrationDisplay: z.string(),
    listingStatus: ListingStatus,
    href: z.string().nullable(),
  }),
});
export type DealerEnquiry = z.infer<typeof DealerEnquiry>;

export const DealerEnquiriesResponse = z.object({
  data: z.array(DealerEnquiry),
  page: CursorPage,
  counts: DealerEnquiryCounts,
});
export type DealerEnquiriesResponse = z.infer<typeof DealerEnquiriesResponse>;

/**
 * `PATCH /v1/dealer/enquiries/:id` — the dealership moves an enquiry between
 * its tabs. Any status may follow any other, so a mistaken Close or Spam is
 * undone by choosing the right one. Setting the status it already has changes
 * nothing and records nothing.
 */
export const UpdateEnquiryInput = z.object({ status: EnquiryStatus }).strict();
export type UpdateEnquiryInput = z.infer<typeof UpdateEnquiryInput>;

/**
 * ── R68 · a customer's own enquiries ──────────────────────────────────────
 *
 * Read-only, and the current state only — no history. The customer sees three
 * states, not the dealer's four: an enquiry the dealership has not acted on is
 * `SENT`; `CONTACTED` once they have called; `CLOSED` once they are done.
 * **Spam is shown as `CLOSED`.** A customer is never told they were marked as
 * spam, and the mapping happens on the server, so `SPAM` is in no response a
 * customer can read.
 */
export const CustomerEnquiryStatus = z.enum(['SENT', 'CONTACTED', 'CLOSED']);
export type CustomerEnquiryStatus = z.infer<typeof CustomerEnquiryStatus>;

export function customerEnquiryStatus(status: EnquiryStatus): CustomerEnquiryStatus {
  if (status === 'NEW') return 'SENT';
  if (status === 'CONTACTED') return 'CONTACTED';
  return 'CLOSED';
}

export const CUSTOMER_ENQUIRY_STATUS_LABELS: Record<CustomerEnquiryStatus, string> = {
  SENT: 'Sent',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
};

export const CUSTOMER_ENQUIRY_STATUS_TONES: Record<CustomerEnquiryStatus, StatusTone> = {
  SENT: 'accent',
  CONTACTED: 'ok',
  CLOSED: 'neutral',
};

/** `GET /v1/enquiries` — newest first, cursor-paginated. */
export const CustomerEnquiryQuery = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type CustomerEnquiryQuery = z.infer<typeof CustomerEnquiryQuery>;

/**
 * One of the customer's enquiries. `vehicle.href` is the car's public page
 * while it is on the marketplace, and null once it is not.
 */
export const CustomerEnquiry = z.object({
  id: Uuid,
  status: CustomerEnquiryStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  message: z.string().nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  dealerName: z.string(),
  vehicle: z.object({
    title: z.string(),
    href: z.string().nullable(),
  }),
});
export type CustomerEnquiry = z.infer<typeof CustomerEnquiry>;

export const CustomerEnquiriesResponse = z.object({
  data: z.array(CustomerEnquiry),
  page: CursorPage,
});
export type CustomerEnquiriesResponse = z.infer<typeof CustomerEnquiriesResponse>;

/**
 * ── R89 · admin oversight of enquiries ─────────────────────────────────────
 *
 * Read-only. The same `enquiries` rows the dealership and the customer see —
 * never a copy — read across every dealership by an operator who needs to
 * know what was asked, by whom, of whom, and what happened next. There is no
 * admin write here: the dealership's inbox stays the only place an enquiry's
 * status changes.
 */

/** A calendar day, `2026-09-26`, read as the IST day it names. */
export const IstDay = z.iso.date('Enter a date as YYYY-MM-DD.');

/**
 * `GET /v1/admin/enquiries`.
 *
 * `q` matches the customer's name or mobile number, the dealership's name, or
 * the car — make, model or plate. `dealer` narrows to one dealership by its
 * public slug (the console links to it from a row and from the dealer page);
 * `from` and `to` bound the day the enquiry was sent, both inclusive.
 */
export const AdminEnquiryQuery = z
  .object({
    status: EnquiryStatus.optional(),
    q: z.string().trim().max(120).optional(),
    dealer: z.string().trim().min(1).max(160).optional(),
    from: IstDay.optional(),
    to: IstDay.optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type AdminEnquiryQuery = z.infer<typeof AdminEnquiryQuery>;

/** The listing an enquiry was about, as the console shows it. */
export const AdminEnquiryVehicle = z.object({
  listingId: Uuid,
  title: z.string(),
  registrationDisplay: z.string(),
  listingStatus: ListingStatus,
  listingStatusLabel: z.string(),
  listingStatusTone: StatusTone,
});
export type AdminEnquiryVehicle = z.infer<typeof AdminEnquiryVehicle>;

/**
 * One row of the oversight list. `messagePreview` is the first line of the
 * message, cut short on the server so the list never carries a thousand
 * characters per row; the whole message is on the detail.
 */
export const AdminEnquiryRow = z.object({
  id: Uuid,
  status: EnquiryStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  messagePreview: z.string().nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  customer: z.object({
    id: Uuid,
    name: z.string(),
    phoneDisplay: z.string().nullable(),
  }),
  dealer: z.object({ id: Uuid, name: z.string(), slug: z.string() }),
  vehicle: AdminEnquiryVehicle,
});
export type AdminEnquiryRow = z.infer<typeof AdminEnquiryRow>;

/**
 * `counts` is per status under every filter except `status` itself, so the
 * tabs say how many of *these* enquiries are in each — switching tab never
 * empties the bar. `dealer` echoes the dealership filter back with its name,
 * or `name: null` when no dealership has that slug.
 */
export const AdminEnquiriesResponse = z.object({
  data: z.array(AdminEnquiryRow),
  page: CursorPage,
  counts: DealerEnquiryCounts,
  dealer: z.object({ slug: z.string(), name: z.string().nullable() }).nullable(),
});
export type AdminEnquiriesResponse = z.infer<typeof AdminEnquiriesResponse>;

/**
 * One recorded step in an enquiry's life, read from the audit trail that has
 * been written since R64. Only what was recorded is shown: an enquiry is never
 * given a history it did not have.
 */
export const AdminEnquiryHistoryEntry = z.object({
  action: z.string(),
  label: z.string(),
  actor: z.string(),
  fromStatus: EnquiryStatus.nullable(),
  toStatus: EnquiryStatus.nullable(),
  at: z.string(),
  atLabel: z.string(),
});
export type AdminEnquiryHistoryEntry = z.infer<typeof AdminEnquiryHistoryEntry>;

/**
 * `GET /v1/admin/enquiries/:id` — everything an operator needs to understand
 * one enquiry. `customerStatusLabel` is what the customer's own page shows,
 * which differs from the dealer's for spam (R68); in a dispute the operator
 * needs both. `vehicle.publicHref` is null once the car has left the
 * marketplace — the listing itself is never deleted, so `adminHref` always
 * resolves.
 */
export const AdminEnquiryDetail = z.object({
  id: Uuid,
  status: EnquiryStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  customerStatusLabel: z.string(),
  message: z.string().nullable(),
  createdAt: z.string(),
  createdLabel: z.string(),
  contactedLabel: z.string().nullable(),
  closedLabel: z.string().nullable(),
  customer: z.object({
    id: Uuid,
    name: z.string(),
    phone: z.string().nullable(),
    phoneDisplay: z.string().nullable(),
    phoneVerified: z.boolean(),
    memberSinceLabel: z.string(),
  }),
  dealer: z.object({
    id: Uuid,
    name: z.string(),
    slug: z.string(),
    statusLabel: z.string(),
    statusTone: StatusTone,
    location: z.string().nullable(),
    phoneDisplay: z.string().nullable(),
    adminHref: z.string(),
  }),
  vehicle: AdminEnquiryVehicle.extend({
    image: z.object({ url: z.string(), alt: z.string() }).nullable(),
    publicHref: z.string().nullable(),
    adminHref: z.string(),
  }),
  history: z.array(AdminEnquiryHistoryEntry),
  /**
   * Support tickets that reference this enquiry (**R91**) — the customer's
   * side of a dispute, one click from the dealer's.
   */
  supportTickets: z.array(
    z.object({
      id: Uuid,
      reference: z.string(),
      subject: z.string(),
      statusLabel: z.string(),
      statusTone: StatusTone,
      createdLabel: z.string(),
    }),
  ),
});
export type AdminEnquiryDetail = z.infer<typeof AdminEnquiryDetail>;
