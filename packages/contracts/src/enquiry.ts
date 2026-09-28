import { z } from 'zod';

import { EnquiryStatus } from './enums.js';

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
