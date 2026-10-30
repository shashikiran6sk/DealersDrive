import { z } from 'zod';
import { CursorPage, Uuid } from './common.js';

/**
 * ── Call leads ────────────────────────────────────────────────────────────
 *
 * A signed-in customer revealed a dealership's customer contact number for one
 * car. One lead per customer and car: a repeat reveal moves the lead's latest
 * time and counts, and is never a second row.
 *
 * A lead is not an enquiry. It has no status to move and asks nothing of the
 * dealer; it tells them who looked at their number, so a missed call can be
 * returned. The customer is told before the number is shown that the dealer
 * will see their name and mobile.
 */

/** `GET /v1/dealer/call-leads` — most recent first, cursor-paginated. */
export const CallLeadQuery = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type CallLeadQuery = z.infer<typeof CallLeadQuery>;

/**
 * One lead. `customer` is read from the customer's account when the list
 * renders — the current name and the proved number, as an enquiry's is.
 * `vehicle.href` is the public page while the car is on the marketplace.
 */
export const CallLead = z.object({
  id: Uuid,
  customer: z.object({
    name: z.string(),
    initials: z.string(),
    phoneDisplay: z.string().nullable(),
    callHref: z.string().nullable(),
  }),
  vehicle: z.object({
    title: z.string(),
    registrationDisplay: z.string(),
    href: z.string().nullable(),
  }),
  revealCount: z.number().int(),
  firstRevealedLabel: z.string(),
  lastRevealedAt: z.string(),
  lastRevealedAgoLabel: z.string(),
});
export type CallLead = z.infer<typeof CallLead>;

export const CallLeadsResponse = z.object({
  data: z.array(CallLead),
  page: CursorPage,
});
export type CallLeadsResponse = z.infer<typeof CallLeadsResponse>;

/**
 * `GET /v1/admin/call-leads` — every dealership's leads, most recent first.
 * `dealer` narrows to one dealership by its public slug.
 */
export const AdminCallLeadQuery = z
  .object({
    dealer: z.string().trim().min(1).max(160).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type AdminCallLeadQuery = z.infer<typeof AdminCallLeadQuery>;

export const AdminCallLead = CallLead.extend({
  dealer: z.object({ name: z.string(), slug: z.string() }),
});
export type AdminCallLead = z.infer<typeof AdminCallLead>;

export const AdminCallLeadsResponse = z.object({
  data: z.array(AdminCallLead),
  page: CursorPage,
});
export type AdminCallLeadsResponse = z.infer<typeof AdminCallLeadsResponse>;
