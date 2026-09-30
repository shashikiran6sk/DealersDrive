import type { Listing, ListingStatus } from '@prisma/client';
import { LISTING_LIFECYCLE_FROM, ListingLifecycleAction } from '@dealers-drive/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  LISTING_TRANSITIONS,
  REACTIVATION_SOURCES,
  RELEASING_STATUSES,
  assertTransition,
  nextStatus,
  transition,
  type ListingActorType,
  type ListingEvent,
} from '../../../../src/modules/listings/listing.state.js';
import type { Tx } from '../../../../src/platform/db/prisma.js';

const STATUSES: ListingStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'ACTIVE',
  'RESERVED',
  'REJECTED',
  'SOLD',
  'WITHDRAWN',
];
const EVENTS = Object.keys(LISTING_TRANSITIONS) as ListingEvent[];
const ACTORS: ListingActorType[] = ['DEALER', 'ADMIN'];

/**
 * The whole table, written out by hand. Every (status, event, actor) triple not
 * on this list must be refused — the test below walks all 8 × 10 × 2 of them.
 */
const ALLOWED: [ListingStatus, ListingEvent, ListingActorType, ListingStatus][] = [
  ['DRAFT', 'submit', 'DEALER', 'PENDING_REVIEW'],
  ['CHANGES_REQUESTED', 'resubmit', 'DEALER', 'PENDING_REVIEW'],
  ['PENDING_REVIEW', 'requestChanges', 'ADMIN', 'CHANGES_REQUESTED'],
  ['PENDING_REVIEW', 'reject', 'ADMIN', 'REJECTED'],
  ['PENDING_REVIEW', 'approve', 'ADMIN', 'ACTIVE'],
  ['ACTIVE', 'reserve', 'DEALER', 'RESERVED'],
  ['ACTIVE', 'markSold', 'DEALER', 'SOLD'],
  ['ACTIVE', 'withdraw', 'DEALER', 'WITHDRAWN'],
  ['ACTIVE', 'withdraw', 'ADMIN', 'WITHDRAWN'],
  ['RESERVED', 'reactivate', 'ADMIN', 'ACTIVE'],
  ['RESERVED', 'markSold', 'DEALER', 'SOLD'],
  ['WITHDRAWN', 'relist', 'ADMIN', 'ACTIVE'],
];

describe('the transition table', () => {
  it('allows exactly the listed transitions and refuses every other one', () => {
    for (const status of STATUSES) {
      for (const event of EVENTS) {
        for (const actor of ACTORS) {
          const expected =
            ALLOWED.find(([s, e, a]) => s === status && e === event && a === actor)?.[3] ?? null;
          expect(nextStatus(status, event, actor), `${status} --${event}/${actor}-->`).toBe(
            expected,
          );
        }
      }
    }
  });

  it('never lets a dealer approve, reject or request changes — even on their own listing', () => {
    for (const event of ['approve', 'reject', 'requestChanges'] as const) {
      for (const status of STATUSES) expect(nextStatus(status, event, 'DEALER')).toBeNull();
    }
  });

  it('never goes straight from a request for changes to live (DESIGN-SPEC §4.9)', () => {
    for (const event of EVENTS) {
      for (const actor of ACTORS) {
        expect(nextStatus('CHANGES_REQUESTED', event, actor)).not.toBe('ACTIVE');
      }
    }
  });

  it('has no way out of REJECTED or SOLD — a sold car never goes back on sale', () => {
    for (const status of ['REJECTED', 'SOLD'] as const) {
      for (const event of EVENTS) {
        for (const actor of ACTORS) expect(nextStatus(status, event, actor)).toBeNull();
      }
    }
  });

  it('lets only the dealership reserve or sell its own car', () => {
    for (const event of ['reserve', 'markSold'] as const) {
      for (const status of STATUSES) expect(nextStatus(status, event, 'ADMIN')).toBeNull();
    }
  });

  it('never lets a dealer put a reserved or withdrawn car back on sale itself', () => {
    for (const event of EVENTS) {
      expect(nextStatus('RESERVED', event, 'DEALER'), event).not.toBe('ACTIVE');
      expect(nextStatus('WITHDRAWN', event, 'DEALER'), event).not.toBe('ACTIVE');
    }
    expect(() => assertTransition('RESERVED', 'reactivate', 'DEALER')).toThrow(
      expect.objectContaining({ status: 403, code: 'LISTING_ACTOR_FORBIDDEN' }),
    );
    expect(() => assertTransition('WITHDRAWN', 'relist', 'DEALER')).toThrow(
      expect.objectContaining({ status: 403, code: 'LISTING_ACTOR_FORBIDDEN' }),
    );
  });

  it('offers a withdrawn car no move but an admin relist', () => {
    for (const event of EVENTS) {
      const to = nextStatus('WITHDRAWN', event, 'DEALER');
      expect(to, event).toBeNull();
    }
  });

  it('never publishes a car that was not reviewed: only approve, reactivate and relist reach ACTIVE', () => {
    const intoActive = ALLOWED.filter(([, , , to]) => to === 'ACTIVE').map(([from, event]) => [
      from,
      event,
    ]);
    expect(intoActive).toEqual([
      ['PENDING_REVIEW', 'approve'],
      ['RESERVED', 'reactivate'],
      ['WITHDRAWN', 'relist'],
    ]);
  });

  it('matches the moves the console offers, one for one (contracts LISTING_LIFECYCLE_FROM)', () => {
    for (const action of ListingLifecycleAction.options) {
      if (action === 'requestReactivation') {
        expect([...LISTING_LIFECYCLE_FROM[action]]).toEqual([...REACTIVATION_SOURCES]);
        continue;
      }
      const allowed = STATUSES.filter((status) => nextStatus(status, action, 'DEALER') !== null);
      expect(allowed, action).toEqual([...LISTING_LIFECYCLE_FROM[action]]);
    }
  });

  it('releases the registration exactly on the terminal states — a withdrawn car keeps it', () => {
    expect([...RELEASING_STATUSES].sort()).toEqual(['REJECTED', 'SOLD']);
  });
});

describe('assertTransition', () => {
  it('names the refusal for each kind of decision', () => {
    expect(() => assertTransition('ACTIVE', 'submit', 'DEALER')).toThrow(
      expect.objectContaining({ status: 409, code: 'LISTING_NOT_SUBMITTABLE' }),
    );
    expect(() => assertTransition('DRAFT', 'approve', 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_APPROVABLE' }),
    );
    expect(() => assertTransition('ACTIVE', 'reject', 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_REVIEWABLE' }),
    );
    expect(() => assertTransition('DRAFT', 'markSold', 'DEALER')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_SELLABLE' }),
    );
    expect(() => assertTransition('SOLD', 'withdraw', 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_WITHDRAWABLE' }),
    );
    expect(() => assertTransition('RESERVED', 'reserve', 'DEALER')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_RESERVABLE' }),
    );
    expect(() => assertTransition('ACTIVE', 'reactivate', 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_RESERVED' }),
    );
    expect(() => assertTransition('SOLD', 'relist', 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_RELISTABLE', status: 409 }),
    );
  });

  it('answers the wrong actor with a 403, not a 409', () => {
    expect(() => assertTransition('PENDING_REVIEW', 'approve', 'DEALER')).toThrow(
      expect.objectContaining({ status: 403, code: 'LISTING_ACTOR_FORBIDDEN' }),
    );
  });
});

function listing(status: ListingStatus, overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    vehicleId: 'vehicle-1',
    dealerId: 'dealer-1',
    status,
    slug: null,
    submittedAt: null,
    lastSubmittedAt: null,
    submissionCount: 0,
    publishedAt: null,
    reservedAt: null,
    soldAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    withdrawalNote: null,
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function fakeTx(count = 1) {
  const updateMany = vi.fn(async (_args: unknown) => ({ count }));
  const vehicleUpdate = vi.fn(async () => ({}));
  const findUniqueOrThrow = vi.fn(async () => listing('ACTIVE'));
  const clearChecks = vi.fn(async () => ({ count: 0 }));
  const cancelRequests = vi.fn(async () => ({ count: 0 }));
  const tx = {
    listing: { updateMany, findUniqueOrThrow },
    vehicle: { update: vehicleUpdate },
    listingCheck: { deleteMany: clearChecks },
    listingReactivationRequest: { updateMany: cancelRequests },
  } as unknown as Tx;
  const audit = { record: vi.fn(async () => undefined), recordDetached: vi.fn() };
  return { tx, audit, updateMany, vehicleUpdate, clearChecks, cancelRequests };
}

const NOW = new Date('2026-09-26T10:00:00Z');
const ADMIN = { type: 'ADMIN' as const, id: 'admin-1' };
const DEALER = { type: 'DEALER' as const, id: 'user-1' };

describe('transition', () => {
  it('writes the new state with the old one in the WHERE, so a racing decision loses', async () => {
    const { tx, audit, updateMany } = fakeTx();
    await transition(tx, audit, listing('PENDING_REVIEW'), 'approve', ADMIN, { now: NOW });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'listing-1', status: 'PENDING_REVIEW' },
      data: {
        status: 'ACTIVE',
        publishedAt: NOW,
        decisionReason: null,
        decidedBy: 'admin-1',
        decidedAt: NOW,
      },
    });
  });

  it('reports a lost race as a 409 rather than overwriting the winner', async () => {
    const { tx, audit } = fakeTx(0);
    await expect(
      transition(tx, audit, listing('PENDING_REVIEW'), 'approve', ADMIN),
    ).rejects.toMatchObject({ status: 409, code: 'LISTING_STATE_CHANGED' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('keeps the first publication date when a listing goes live again', async () => {
    const first = new Date('2026-01-01T00:00:00Z');
    const { tx, audit, updateMany } = fakeTx();
    await transition(
      tx,
      audit,
      listing('PENDING_REVIEW', { publishedAt: first }),
      'approve',
      ADMIN,
      {
        now: NOW,
      },
    );
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { publishedAt: first } });
  });

  it('counts submissions and keeps the first submission date on a resubmit', async () => {
    const first = new Date('2026-09-01T00:00:00Z');
    const { tx, audit, updateMany } = fakeTx();
    await transition(
      tx,
      audit,
      listing('CHANGES_REQUESTED', { submittedAt: first, submissionCount: 1 }),
      'resubmit',
      DEALER,
      { now: NOW },
    );
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: 'PENDING_REVIEW',
        submittedAt: first,
        lastSubmittedAt: NOW,
        submissionCount: 2,
      },
    });
  });

  it.each(['requestChanges', 'reject'] as const)('refuses %s without a reason', async (event) => {
    const { tx, audit, updateMany } = fakeTx();
    await expect(
      transition(tx, audit, listing('PENDING_REVIEW'), event, ADMIN, { reason: '   ' }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('stores the moderator’s reason and who decided', async () => {
    const { tx, audit, updateMany } = fakeTx();
    await transition(tx, audit, listing('PENDING_REVIEW'), 'requestChanges', ADMIN, {
      reason: ' The odometer photo does not match. ',
      now: NOW,
    });
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: 'CHANGES_REQUESTED',
        decisionReason: 'The odometer photo does not match.',
        decidedBy: 'admin-1',
        decidedAt: NOW,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'listing.changes_requested',
        actorType: 'ADMIN',
        entityType: 'Listing',
        before: { status: 'PENDING_REVIEW' },
        after: {
          status: 'CHANGES_REQUESTED',
          vehicleId: 'vehicle-1',
          reason: 'The odometer photo does not match.',
        },
      }),
    );
  });

  it.each([
    ['PENDING_REVIEW', 'reject', ADMIN, { reason: 'Stolen vehicle report.' }],
    ['ACTIVE', 'markSold', DEALER, {}],
    ['RESERVED', 'markSold', DEALER, {}],
  ] as const)(
    'releases the plate when %s --%s--> a terminal state',
    async (status, event, actor, extra) => {
      const { tx, audit, vehicleUpdate } = fakeTx();
      await transition(tx, audit, listing(status), event, actor, { ...extra, now: NOW });
      expect(vehicleUpdate).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        data: { releasedAt: NOW },
      });
    },
  );

  it('stamps the sold time', async () => {
    const sold = fakeTx();
    await transition(sold.tx, sold.audit, listing('RESERVED'), 'markSold', DEALER, { now: NOW });
    expect(sold.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: 'RESERVED' },
      data: { status: 'SOLD', soldAt: NOW },
    });
  });

  it('stamps a reservation, and clears it when the car goes back on sale', async () => {
    const reserved = fakeTx();
    await transition(reserved.tx, reserved.audit, listing('ACTIVE'), 'reserve', DEALER, {
      now: NOW,
    });
    expect(reserved.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: 'listing-1', status: 'ACTIVE' },
      data: { status: 'RESERVED', reservedAt: NOW },
    });

    const back = fakeTx();
    await transition(
      back.tx,
      back.audit,
      listing('RESERVED', { reservedAt: NOW }),
      'reactivate',
      ADMIN,
    );
    expect(back.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: 'listing-1', status: 'RESERVED' },
      data: { status: 'ACTIVE', reservedAt: null },
    });
  });

  it('does not treat putting a car back on sale as a moderation decision', async () => {
    const first = new Date('2026-01-01T00:00:00Z');
    const { tx, audit, updateMany } = fakeTx();
    await transition(
      tx,
      audit,
      listing('WITHDRAWN', { publishedAt: first, decidedBy: 'admin-1', decidedAt: first }),
      'relist',
      ADMIN,
      { now: NOW },
    );
    const data = updateMany.mock.calls[0]?.[0];
    expect(data).toEqual({
      where: { id: 'listing-1', status: 'WITHDRAWN' },
      data: {
        status: 'ACTIVE',
        reservedAt: null,
        withdrawnAt: null,
        withdrawalReason: null,
        withdrawalNote: null,
      },
    });
  });

  it('records why a listing was withdrawn, and says so in the audit row without the note', async () => {
    const { tx, audit, updateMany, vehicleUpdate } = fakeTx();
    await transition(tx, audit, listing('ACTIVE'), 'withdraw', DEALER, {
      withdrawal: { reason: 'DOCUMENT_ISSUE', note: '  RC is with the bank.  ' },
      now: NOW,
    });
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: NOW,
        withdrawalReason: 'DOCUMENT_ISSUE',
        withdrawalNote: 'RC is with the bank.',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'listing.withdrawn',
        after: {
          status: 'WITHDRAWN',
          vehicleId: 'vehicle-1',
          withdrawalReason: 'DOCUMENT_ISSUE',
          hasNote: true,
        },
      }),
    );
    expect(vehicleUpdate).not.toHaveBeenCalled();
  });

  it('stores no note when the dealer leaves it blank', async () => {
    const { tx, audit, updateMany } = fakeTx();
    await transition(tx, audit, listing('ACTIVE'), 'withdraw', DEALER, {
      withdrawal: { reason: 'OTHER', note: '   ' },
    });
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { withdrawalNote: null } });
  });

  it('refuses a withdrawal with no reason', async () => {
    const { tx, audit, updateMany } = fakeTx();
    await expect(
      transition(tx, audit, listing('ACTIVE'), 'withdraw', DEALER),
    ).rejects.toMatchObject({ code: 'WITHDRAWAL_REASON_REQUIRED', status: 422 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['reserve', 'listing.reserved'],
    ['markSold', 'listing.marked_sold'],
  ] as const)('audits %s as %s', async (event, action) => {
    const { tx, audit } = fakeTx();
    await transition(tx, audit, listing('ACTIVE'), event, DEALER);
    expect(audit.record).toHaveBeenCalledWith(tx, expect.objectContaining({ action }));
  });

  it.each([
    ['RESERVED', 'reactivate', 'listing.reactivated'],
    ['WITHDRAWN', 'relist', 'listing.relisted'],
  ] as const)('audits %s --%s--> as %s', async (status, event, action) => {
    const { tx, audit } = fakeTx();
    await transition(tx, audit, listing(status), event, ADMIN);
    expect(audit.record).toHaveBeenCalledWith(tx, expect.objectContaining({ action }));
  });

  it('closes a pending reactivation request when a reserved car is sold', async () => {
    const { tx, audit, cancelRequests } = fakeTx();
    await transition(tx, audit, listing('RESERVED'), 'markSold', DEALER, { now: NOW });
    expect(cancelRequests).toHaveBeenCalledWith({
      where: { listingId: 'listing-1', status: 'PENDING' },
      data: { status: 'CANCELLED', reviewedAt: NOW },
    });
  });

  it('touches no reactivation request on a move out of any other state', async () => {
    const { tx, audit, cancelRequests } = fakeTx();
    await transition(tx, audit, listing('ACTIVE'), 'reserve', DEALER);
    expect(cancelRequests).not.toHaveBeenCalled();
  });

  it('does not release the plate on a non-terminal move', async () => {
    const { tx, audit, vehicleUpdate } = fakeTx();
    await transition(tx, audit, listing('DRAFT'), 'submit', DEALER);
    expect(vehicleUpdate).not.toHaveBeenCalled();
  });
});

describe('the checklist and resubmission (F070)', () => {
  it('clears the checklist whenever a listing enters review, so old checks never carry over', async () => {
    const { tx, audit, clearChecks } = fakeTx();
    await transition(tx, audit, listing('CHANGES_REQUESTED'), 'resubmit', DEALER);
    expect(clearChecks).toHaveBeenCalledWith({ where: { listingId: 'listing-1' } });
  });

  it('keeps the checklist on a decision', async () => {
    const { tx, audit, clearChecks } = fakeTx();
    await transition(tx, audit, listing('PENDING_REVIEW'), 'approve', ADMIN);
    expect(clearChecks).not.toHaveBeenCalled();
  });
});
