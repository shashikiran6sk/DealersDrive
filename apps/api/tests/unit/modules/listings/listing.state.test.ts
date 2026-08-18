import type { Listing, ListingStatus, Vehicle } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  canTransition,
  displayStatus,
  transition,
  type Actor,
  type ListingEvent,
} from '../../../../src/modules/listings/listing.state.js';
import { ConflictError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/listings/listing.state.ts`.
 *
 * `Listing.status` is never assigned anywhere in the codebase — every change goes
 * through `transition`, which is therefore the whole authorization surface of the
 * listing lifecycle. `listing-lifecycle.test.ts` covers the table as a unit at the
 * HTTP level; this file covers it exhaustively, every event against every source
 * state and every actor, because a single wrong cell here is a dealer approving
 * their own listing.
 */
const STATUSES: ListingStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'EXPIRED',
  'SOLD',
  'REMOVED',
];

const ACTORS: Actor[] = ['DEALER', 'ADMIN', 'SYSTEM'];

/** The table, restated independently of the implementation. */
const ALLOWED: Record<ListingEvent, { actors: Actor[]; from: ListingStatus[]; to: ListingStatus }> =
  {
    SUBMIT: { actors: ['DEALER'], from: [], to: 'PENDING_REVIEW' },
    RESUBMIT: { actors: ['DEALER'], from: ['REJECTED', 'CHANGES_REQUESTED'], to: 'PENDING_REVIEW' },
    APPROVE: { actors: ['ADMIN'], from: ['PENDING_REVIEW'], to: 'APPROVED' },
    REJECT: { actors: ['ADMIN'], from: ['PENDING_REVIEW'], to: 'REJECTED' },
    REQUEST_CHANGES: { actors: ['ADMIN'], from: ['PENDING_REVIEW'], to: 'CHANGES_REQUESTED' },
    EXPIRE: { actors: ['SYSTEM'], from: ['APPROVED'], to: 'EXPIRED' },
    MARK_SOLD: { actors: ['DEALER', 'ADMIN'], from: ['APPROVED', 'EXPIRED'], to: 'SOLD' },
    TAKEDOWN: {
      actors: ['ADMIN'],
      from: ['APPROVED', 'PENDING_REVIEW', 'CHANGES_REQUESTED'],
      to: 'REMOVED',
    },
    RENEW: { actors: ['DEALER'], from: ['EXPIRED'], to: 'PENDING_REVIEW' },
  };

const EVENTS = Object.keys(ALLOWED) as ListingEvent[];

function listing(status: ListingStatus): Pick<Listing, 'status'> {
  return { status };
}

describe('transition, over the whole table', () => {
  it.each(EVENTS)('%s permits exactly the actors and states the table names', (event) => {
    const rule = ALLOWED[event];

    for (const actor of ACTORS) {
      for (const status of STATUSES) {
        const permitted = rule.actors.includes(actor) && rule.from.includes(status);

        if (permitted) {
          expect(
            transition(listing(status), event, actor),
            `${actor} ${event} from ${status}`,
          ).toBe(rule.to);
        } else {
          expect(
            () => transition(listing(status), event, actor),
            `${actor} ${event} from ${status} should be refused`,
          ).toThrow(ConflictError);
        }
      }
    }
  });
});

describe('the moves that matter most', () => {
  it('lets an admin approve a listing in review', () => {
    expect(transition(listing('PENDING_REVIEW'), 'APPROVE', 'ADMIN')).toBe('APPROVED');
  });

  it('refuses to let a dealer approve their own listing', () => {
    // The whole revenue model rests on this cell.
    expect(() => transition(listing('PENDING_REVIEW'), 'APPROVE', 'DEALER')).toThrow(
      /dealer may not approve a listing/,
    );
  });

  it('refuses a second approval, so two moderators cannot double-publish', () => {
    // API-SPEC D9: the second moderator gets a clear error, not a duplicate.
    expect(() => transition(listing('APPROVED'), 'APPROVE', 'ADMIN')).toThrow(
      /already approved|is approved and cannot be approved/i,
    );
  });

  it('only the system expires a listing', () => {
    expect(transition(listing('APPROVED'), 'EXPIRE', 'SYSTEM')).toBe('EXPIRED');
    expect(() => transition(listing('APPROVED'), 'EXPIRE', 'ADMIN')).toThrow(ConflictError);
    expect(() => transition(listing('APPROVED'), 'EXPIRE', 'DEALER')).toThrow(ConflictError);
  });

  it('lets a dealer resubmit after a rejection or a change request', () => {
    expect(transition(listing('REJECTED'), 'RESUBMIT', 'DEALER')).toBe('PENDING_REVIEW');
    expect(transition(listing('CHANGES_REQUESTED'), 'RESUBMIT', 'DEALER')).toBe('PENDING_REVIEW');
  });

  it('lets a dealer or an admin mark a sold car sold, from live or expired', () => {
    for (const actor of ['DEALER', 'ADMIN'] as const) {
      expect(transition(listing('APPROVED'), 'MARK_SOLD', actor)).toBe('SOLD');
      expect(transition(listing('EXPIRED'), 'MARK_SOLD', actor)).toBe('SOLD');
    }
  });

  it('refuses to mark an unpublished car sold', () => {
    expect(() => transition(listing('PENDING_REVIEW'), 'MARK_SOLD', 'DEALER')).toThrow(
      ConflictError,
    );
  });

  it('lets an admin take down anything that is visible or in the queue', () => {
    for (const status of ['APPROVED', 'PENDING_REVIEW', 'CHANGES_REQUESTED'] as const) {
      expect(transition(listing(status), 'TAKEDOWN', 'ADMIN')).toBe('REMOVED');
    }
  });

  it('only renews from EXPIRED', () => {
    expect(transition(listing('EXPIRED'), 'RENEW', 'DEALER')).toBe('PENDING_REVIEW');
    expect(() => transition(listing('APPROVED'), 'RENEW', 'DEALER')).toThrow(ConflictError);
  });

  it('never accepts SUBMIT as a move, because SUBMIT creates the listing', () => {
    // The rule exists so the guard list has a single home; there is no source
    // state a submit can legitimately move from.
    for (const status of STATUSES) {
      expect(() => transition(listing(status), 'SUBMIT', 'DEALER')).toThrow(ConflictError);
    }
  });

  it('treats SOLD and REMOVED as terminal for every event', () => {
    for (const status of ['SOLD', 'REMOVED'] as const) {
      for (const event of EVENTS) {
        for (const actor of ACTORS) {
          expect(
            () => transition(listing(status), event, actor),
            `${event} from ${status}`,
          ).toThrow(ConflictError);
        }
      }
    }
  });
});

describe('the errors it raises', () => {
  it('always reports INVALID_TRANSITION with a 409', () => {
    try {
      transition(listing('APPROVED'), 'APPROVE', 'ADMIN');
      expect.unreachable('a double approval must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe('INVALID_TRANSITION');
      expect((error as ConflictError).status).toBe(409);
    }
  });

  it('checks the actor before the state, so the message names the real problem', () => {
    // A dealer trying to approve an already-approved listing is refused for
    // being a dealer, which is the more useful thing to say.
    expect(() => transition(listing('APPROVED'), 'APPROVE', 'DEALER')).toThrow(
      /dealer may not approve/,
    );
  });

  it('writes messages a dealer can act on, with no enum shouting', () => {
    const cases: [ListingStatus, ListingEvent, Actor][] = [
      ['PENDING_REVIEW', 'MARK_SOLD', 'DEALER'],
      ['APPROVED', 'RENEW', 'DEALER'],
      ['SOLD', 'APPROVE', 'ADMIN'],
    ];

    for (const [status, event, actor] of cases) {
      try {
        transition(listing(status), event, actor);
        expect.unreachable();
      } catch (error) {
        const detail = (error as ConflictError).detail;
        expect(detail, `${status}/${event}`).not.toMatch(/[A-Z]{2,}_[A-Z]{2,}/);
        expect(detail.endsWith('.')).toBe(true);
      }
    }
  });

  it('names both the current state and the attempted one', () => {
    try {
      transition(listing('CHANGES_REQUESTED'), 'MARK_SOLD', 'DEALER');
      expect.unreachable();
    } catch (error) {
      const detail = (error as ConflictError).detail;
      expect(detail).toContain('changes requested');
      expect(detail).toContain('sold');
    }
  });
});

describe('canTransition', () => {
  it('agrees with transition on every combination', () => {
    for (const event of EVENTS) {
      for (const actor of ACTORS) {
        for (const status of STATUSES) {
          let expected = true;
          try {
            transition(listing(status), event, actor);
          } catch {
            expected = false;
          }

          expect(
            canTransition(listing(status), event, actor),
            `${actor} ${event} from ${status}`,
          ).toBe(expected);
        }
      }
    }
  });

  it('answers without throwing, so it is safe in a DTO mapper', () => {
    // The inventory row's `canRenew`/`canMarkSold` flags are built from this; a
    // throw there would 500 the whole list.
    expect(() => canTransition(listing('SOLD'), 'APPROVE', 'DEALER')).not.toThrow();
    expect(canTransition(listing('SOLD'), 'APPROVE', 'DEALER')).toBe(false);
  });
});

describe('displayStatus', () => {
  function vehicle(status: Vehicle['status']): Pick<Vehicle, 'status'> {
    return { status };
  }

  it('is DRAFT when there is no listing at all', () => {
    expect(displayStatus(vehicle('DRAFT'), null)).toBe('DRAFT');
  });

  it('is SOLD as soon as the vehicle is sold, whatever the listing says', () => {
    // The vehicle wins: a sold car whose listing is still APPROVED must not read
    // as live for the seconds before the index catches up.
    for (const status of STATUSES) {
      expect(displayStatus(vehicle('SOLD'), listing(status)), status).toBe('SOLD');
    }
  });

  it('maps each listing status to the label the UI renders', () => {
    const expected: [ListingStatus, string][] = [
      ['PENDING_REVIEW', 'PENDING'],
      ['CHANGES_REQUESTED', 'CHANGES_REQUESTED'],
      ['REJECTED', 'REJECTED'],
      ['EXPIRED', 'EXPIRED'],
      ['REMOVED', 'REMOVED'],
      ['SOLD', 'SOLD'],
      ['APPROVED', 'ACTIVE'],
    ];

    for (const [status, display] of expected) {
      expect(displayStatus(vehicle('DRAFT'), listing(status)), status).toBe(display);
    }
  });

  it('calls an approved listing ACTIVE rather than APPROVED', () => {
    // §27: one derived field, computed once here. "Approved" is a moderation
    // outcome; "Active" is what the dealer cares about.
    expect(displayStatus(vehicle('READY'), listing('APPROVED'))).toBe('ACTIVE');
  });

  it('covers every listing status, so nothing falls through to DRAFT', () => {
    for (const status of STATUSES) {
      expect(displayStatus(vehicle('DRAFT'), listing(status)), status).not.toBe('DRAFT');
    }
  });
});
