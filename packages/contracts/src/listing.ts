import { z } from 'zod';

import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONES,
  type DisplayStatus,
  ListingStatus,
  StatusTone,
  WITHDRAWAL_REASON_LABELS,
  WithdrawalReason,
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

/**
 * The two public rules (**R71**), and the split between them is load-bearing.
 *
 * **Visible** is what a buyer can see on the marketplace: ACTIVE and RESERVED.
 * A reserved car stays on `/cars` and on its dealership's page — greyed, marked
 * Reserved and not clickable — because a dealer who moves stock should be seen
 * to. **Available** is what a buyer can act on: ACTIVE alone. Every count that
 * says "available", every facet, the directory's car counts, similar vehicles,
 * the homepage's promoted rows and the enquiry guard all mean available.
 *
 * SOLD and WITHDRAWN are neither: gone from every public surface.
 */
export const LISTING_PUBLIC_VISIBLE_STATUSES: readonly ListingStatus[] = ['ACTIVE', 'RESERVED'];

export const LISTING_AVAILABLE_STATUS: ListingStatus = 'ACTIVE';

export function isListingPubliclyVisible(status: ListingStatus): boolean {
  return LISTING_PUBLIC_VISIBLE_STATUSES.includes(status);
}

export function isListingAvailable(status: ListingStatus): boolean {
  return status === LISTING_AVAILABLE_STATUS;
}

/**
 * How a car stands for a buyer (**R71**): the one field a public card or page
 * carries about the lifecycle. SOLD and UNAVAILABLE are never on the
 * marketplace; they exist for a customer's own saved cars, which keep what was
 * saved and say plainly what became of it.
 */
export const PublicAvailability = z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'UNAVAILABLE']);
export type PublicAvailability = z.infer<typeof PublicAvailability>;

export const PUBLIC_AVAILABILITY_LABELS: Record<PublicAvailability, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  SOLD: 'Sold',
  UNAVAILABLE: 'No longer available',
};

const PUBLIC_AVAILABILITY_OF: Record<ListingStatus, PublicAvailability> = {
  DRAFT: 'UNAVAILABLE',
  PENDING_REVIEW: 'UNAVAILABLE',
  CHANGES_REQUESTED: 'UNAVAILABLE',
  ACTIVE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  REJECTED: 'UNAVAILABLE',
  SOLD: 'SOLD',
  WITHDRAWN: 'UNAVAILABLE',
};

export function publicAvailabilityOf(status: ListingStatus): PublicAvailability {
  return PUBLIC_AVAILABILITY_OF[status];
}

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
 * The moves a dealership makes on a listing once it has been live (**R69**, as
 * revised by the reactivation review). Each is its own route — there is no "set
 * status" — and the first three map one-for-one onto an event of the API's
 * state machine, which is the authority; this table is the console's copy of
 * it, and a test in the API holds the two together.
 *
 * A dealer never puts a car back on sale directly. RESERVED → ACTIVE and
 * WITHDRAWN → ACTIVE are admin decisions: the dealer's move is
 * `requestReactivation`, which files a request an admin approves or rejects.
 *
 * There is deliberately no way back from SOLD: a sold car is history, and a
 * sale recorded by mistake is an administrative correction, not a toggle.
 */
export const ListingLifecycleAction = z.enum([
  'reserve',
  'markSold',
  'withdraw',
  'requestReactivation',
]);
export type ListingLifecycleAction = z.infer<typeof ListingLifecycleAction>;

/** The statuses a dealer may ask to have put back on sale. */
export const REACTIVATABLE_STATUSES: readonly ListingStatus[] = ['RESERVED', 'WITHDRAWN'];

export function isListingReactivatable(status: ListingStatus): boolean {
  return REACTIVATABLE_STATUSES.includes(status);
}

export const LISTING_LIFECYCLE_FROM: Record<ListingLifecycleAction, readonly ListingStatus[]> = {
  reserve: ['ACTIVE'],
  markSold: ['ACTIVE', 'RESERVED'],
  withdraw: ['ACTIVE'],
  requestReactivation: REACTIVATABLE_STATUSES,
};

export interface LifecycleActionOptions {
  /** A reactivation request is already waiting, so another cannot be filed. */
  reactivationPending?: boolean;
}

/** Which lifecycle moves a listing in `status` offers, in the order the console shows them. */
export function lifecycleActionsOf(
  status: ListingStatus,
  options: LifecycleActionOptions = {},
): ListingLifecycleAction[] {
  return ListingLifecycleAction.options.filter(
    (action) =>
      LISTING_LIFECYCLE_FROM[action].includes(status) &&
      !(action === 'requestReactivation' && options.reactivationPending),
  );
}

/**
 * Where a dealer's request to put a reserved or withdrawn car back on sale has
 * got to. Mirrors the Prisma enum of the same name. CANCELLED is the request
 * the listing outran: the dealer sold the reserved car before an admin decided,
 * so there was nothing left to approve.
 */
export const ReactivationRequestStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export type ReactivationRequestStatus = z.infer<typeof ReactivationRequestStatus>;

export const REACTIVATION_STATUS_LABELS: Record<ReactivationRequestStatus, string> = {
  PENDING: 'Reactivation pending approval',
  APPROVED: 'Reactivation approved',
  REJECTED: 'Reactivation declined',
  CANCELLED: 'Reactivation request closed',
};

export const REACTIVATION_STATUS_TONES: Record<ReactivationRequestStatus, StatusTone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'err',
  CANCELLED: 'neutral',
};

/**
 * The body of `POST /v1/dealer/vehicles/:id/request-reactivation`. The reason
 * is optional: the dealer's own words to the reviewer, never published.
 */
export const RequestReactivationInput = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();
export type RequestReactivationInput = z.infer<typeof RequestReactivationInput>;

/** The listing's latest reactivation request, as its own dealership sees it. */
export const ListingReactivation = z.object({
  id: z.string().uuid(),
  status: ReactivationRequestStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  fromStatus: ListingStatus,
  reason: z.string().nullable(),
  requestedAt: z.string(),
  reviewedAt: z.string().nullable(),
  /** The reviewer's note on a decision, shown to the dealer verbatim. */
  adminNote: z.string().nullable(),
});
export type ListingReactivation = z.infer<typeof ListingReactivation>;

export function withdrawalReasonLabel(reason: WithdrawalReason): string {
  return WITHDRAWAL_REASON_LABELS[reason];
}

/**
 * The body of `POST /v1/dealer/vehicles/:id/withdraw`. The reason is one of a
 * fixed set so it can be counted; the note is the dealer's own words, kept for
 * the dealership and never published.
 */
export const WithdrawListingInput = z
  .object({
    reason: WithdrawalReason,
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type WithdrawListingInput = z.infer<typeof WithdrawListingInput>;

/** A withdrawal as the dealership sees it on its own listing. */
export const ListingWithdrawal = z.object({
  reason: WithdrawalReason,
  reasonLabel: z.string(),
  note: z.string().nullable(),
});
export type ListingWithdrawal = z.infer<typeof ListingWithdrawal>;

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
  /** The public address once it has been live, for the console's "View on site". */
  slug: z.string().nullable(),
  reservedAt: z.string().nullable(),
  soldAt: z.string().nullable(),
  withdrawnAt: z.string().nullable(),
  withdrawal: ListingWithdrawal.nullable(),
  canEdit: z.boolean(),
  canSubmit: z.boolean(),
  canDelete: z.boolean(),
  /** The lifecycle moves this listing offers now (**R69**). */
  actions: z.array(ListingLifecycleAction),
  /**
   * The latest reactivation request while it still describes the listing: a
   * pending one, or a decided one on a listing still reserved or withdrawn.
   */
  reactivation: ListingReactivation.nullable(),
});
export type DealerListing = z.infer<typeof DealerListing>;
