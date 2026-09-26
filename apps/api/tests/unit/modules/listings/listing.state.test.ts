import type { Listing, ListingStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  LISTING_TRANSITIONS,
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
  'REJECTED',
  'SOLD',
  'REMOVED',
];
const EVENTS = Object.keys(LISTING_TRANSITIONS) as ListingEvent[];
const ACTORS: ListingActorType[] = ['DEALER', 'ADMIN'];

/**
 * The whole table, written out by hand. Every (status, event, actor) triple not
 * on this list must be refused — the test below walks all 7 × 7 × 2 of them.
 */
const ALLOWED: [ListingStatus, ListingEvent, ListingActorType, ListingStatus][] = [
  ['DRAFT', 'submit', 'DEALER', 'PENDING_REVIEW'],
  ['CHANGES_REQUESTED', 'resubmit', 'DEALER', 'PENDING_REVIEW'],
  ['PENDING_REVIEW', 'requestChanges', 'ADMIN', 'CHANGES_REQUESTED'],
  ['PENDING_REVIEW', 'reject', 'ADMIN', 'REJECTED'],
  ['PENDING_REVIEW', 'approve', 'ADMIN', 'ACTIVE'],
  ['ACTIVE', 'markSold', 'DEALER', 'SOLD'],
  ['ACTIVE', 'remove', 'DEALER', 'REMOVED'],
  ['ACTIVE', 'remove', 'ADMIN', 'REMOVED'],
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

  it('has no way out of REJECTED, SOLD or REMOVED', () => {
    for (const status of ['REJECTED', 'SOLD', 'REMOVED'] as const) {
      for (const event of EVENTS) {
        for (const actor of ACTORS) expect(nextStatus(status, event, actor)).toBeNull();
      }
    }
  });

  it('releases the registration exactly on the terminal states', () => {
    expect([...RELEASING_STATUSES].sort()).toEqual(['REJECTED', 'REMOVED', 'SOLD']);
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
    expect(() => assertTransition('SOLD', 'remove', 'ADMIN')).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_REMOVABLE' }),
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
    soldAt: null,
    removedAt: null,
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
  const tx = {
    listing: { updateMany, findUniqueOrThrow },
    vehicle: { update: vehicleUpdate },
    listingCheck: { deleteMany: clearChecks },
  } as unknown as Tx;
  const audit = { record: vi.fn(async () => undefined), recordDetached: vi.fn() };
  return { tx, audit, updateMany, vehicleUpdate, clearChecks };
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
    ['ACTIVE', 'remove', DEALER, {}],
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

  it('stamps sold and removed times', async () => {
    const sold = fakeTx();
    await transition(sold.tx, sold.audit, listing('ACTIVE'), 'markSold', DEALER, { now: NOW });
    expect(sold.updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { soldAt: NOW } });

    const removed = fakeTx();
    await transition(removed.tx, removed.audit, listing('ACTIVE'), 'remove', ADMIN, { now: NOW });
    expect(removed.updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { removedAt: NOW } });
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
