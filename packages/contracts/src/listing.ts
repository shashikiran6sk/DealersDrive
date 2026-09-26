import { z } from 'zod';

import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONES,
  type DisplayStatus,
  ListingStatus,
  StatusTone,
} from './enums.js';

/**
 * A listing's lifecycle as both apps need to read it (**F064**, **R47**).
 *
 * The transitions themselves live in the API (`listing.state.ts`), because a
 * transition is a write and only the server writes. What lives here is what a
 * *status* means — which ones a dealer may still edit, which one is public —
 * so the console never offers an Edit the server would refuse.
 */
export const LISTING_EDITABLE_STATUSES: readonly ListingStatus[] = ['DRAFT', 'CHANGES_REQUESTED'];

/** Only an ACTIVE listing is public (DESIGN-SPEC §4.9). */
export const LISTING_PUBLIC_STATUS: ListingStatus = 'ACTIVE';

export function isListingEditable(status: ListingStatus): boolean {
  return LISTING_EDITABLE_STATUSES.includes(status);
}

/** Submitting is the move out of an editable state, so the two sets are one. */
export function isListingSubmittable(status: ListingStatus): boolean {
  return isListingEditable(status);
}

/** A draft that has never been submitted can be thrown away; anything else is history. */
export function isListingDeletable(status: ListingStatus): boolean {
  return status === 'DRAFT';
}

export function displayStatusOf(status: ListingStatus): DisplayStatus {
  return status === 'PENDING_REVIEW' ? 'PENDING' : status;
}

export function listingStatusLabel(status: ListingStatus): string {
  return DISPLAY_STATUS_LABELS[displayStatusOf(status)];
}

export function listingStatusTone(status: ListingStatus): StatusTone {
  return DISPLAY_STATUS_TONES[displayStatusOf(status)];
}

/**
 * The listing block on a vehicle, as its own dealership sees it.
 *
 * `reason` is the moderator's words on a request for changes or a rejection,
 * shown verbatim (DESIGN-SPEC §4.9). The `can*` flags are the server's answer
 * to "which buttons exist", computed with the functions above.
 */
export const DealerListing = z.object({
  id: z.string().uuid(),
  status: ListingStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  reason: z.string().nullable(),
  submittedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  canEdit: z.boolean(),
  canSubmit: z.boolean(),
  canDelete: z.boolean(),
});
export type DealerListing = z.infer<typeof DealerListing>;
