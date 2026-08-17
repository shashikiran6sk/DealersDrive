import type { DisplayStatus } from '@dealers-drive/contracts';
import type { Listing, ListingStatus, Vehicle } from '@prisma/client';

import { ConflictError } from '../../platform/errors.js';

/**
 * The listing state machine (ARCHITECTURE §10).
 *
 * `Listing.status` is never assigned. Every change goes through `transition`,
 * which validates the source state **and** the actor's authority to make the
 * move. `Listing.status` also appears in no dealer-writable DTO, and every
 * input schema is `.strict()`, so a dealer posting `{"status":"APPROVED"}`
 * gets a 400 rather than a silent success. Those two facts together are the
 * defence; neither is sufficient alone.
 */
export type ListingEvent =
  | 'SUBMIT'
  | 'RESUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CHANGES'
  | 'EXPIRE'
  | 'MARK_SOLD'
  | 'TAKEDOWN'
  | 'RENEW';

export type Actor = 'DEALER' | 'ADMIN' | 'SYSTEM';

interface Rule {
  from: ListingStatus[];
  to: ListingStatus;
  actors: Actor[];
}

const RULES: Record<ListingEvent, Rule> = {
  // SUBMIT creates the listing rather than moving one; it is here so the
  // guard list has a single home.
  SUBMIT: { from: [], to: 'PENDING_REVIEW', actors: ['DEALER'] },
  RESUBMIT: {
    from: ['REJECTED', 'CHANGES_REQUESTED'],
    to: 'PENDING_REVIEW',
    actors: ['DEALER'],
  },
  APPROVE: { from: ['PENDING_REVIEW'], to: 'APPROVED', actors: ['ADMIN'] },
  REJECT: { from: ['PENDING_REVIEW'], to: 'REJECTED', actors: ['ADMIN'] },
  REQUEST_CHANGES: { from: ['PENDING_REVIEW'], to: 'CHANGES_REQUESTED', actors: ['ADMIN'] },
  EXPIRE: { from: ['APPROVED'], to: 'EXPIRED', actors: ['SYSTEM'] },
  MARK_SOLD: { from: ['APPROVED', 'EXPIRED'], to: 'SOLD', actors: ['DEALER', 'ADMIN'] },
  TAKEDOWN: {
    from: ['APPROVED', 'PENDING_REVIEW', 'CHANGES_REQUESTED'],
    to: 'REMOVED',
    actors: ['ADMIN'],
  },
  RENEW: { from: ['EXPIRED'], to: 'PENDING_REVIEW', actors: ['DEALER'] },
};

/**
 * Validates the move and returns the next status. Assignment is never used —
 * `listing.status = …` anywhere outside this module is a bug.
 */
export function transition(
  listing: Pick<Listing, 'status'>,
  event: ListingEvent,
  actor: Actor,
): ListingStatus {
  const rule = RULES[event];

  if (!rule.actors.includes(actor)) {
    throw new ConflictError(
      'INVALID_TRANSITION',
      `A ${actor.toLowerCase()} may not ${event.toLowerCase().replace('_', ' ')} a listing.`,
    );
  }

  if (!rule.from.includes(listing.status)) {
    // Two moderators opening the same card is expected; the second one gets a
    // clear error rather than a double approval (API-SPEC D9).
    throw new ConflictError(
      'INVALID_TRANSITION',
      `This listing is ${listing.status.toLowerCase().replace(/_/g, ' ')} and cannot be ${rule.to
        .toLowerCase()
        .replace(/_/g, ' ')}.`,
    );
  }

  return rule.to;
}

export function canTransition(
  listing: Pick<Listing, 'status'>,
  event: ListingEvent,
  actor: Actor,
): boolean {
  try {
    transition(listing, event, actor);
    return true;
  } catch {
    return false;
  }
}

/**
 * The single derived field the UI renders (ARCHITECTURE §27). Computed once,
 * here, in the API. If two clients ever derived it independently they would
 * disagree, and the disagreement would be about whether a dealer's car is live.
 */
export function displayStatus(
  vehicle: Pick<Vehicle, 'status'>,
  listing: Pick<Listing, 'status'> | null,
): DisplayStatus {
  if (!listing) return 'DRAFT';
  if (vehicle.status === 'SOLD') return 'SOLD';

  switch (listing.status) {
    case 'PENDING_REVIEW':
      return 'PENDING';
    case 'CHANGES_REQUESTED':
      return 'CHANGES_REQUESTED';
    case 'REJECTED':
      return 'REJECTED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'REMOVED':
      return 'REMOVED';
    case 'SOLD':
      return 'SOLD';
    case 'APPROVED':
      return 'ACTIVE';
    default:
      return 'DRAFT';
  }
}
