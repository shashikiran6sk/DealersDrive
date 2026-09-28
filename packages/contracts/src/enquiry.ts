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
