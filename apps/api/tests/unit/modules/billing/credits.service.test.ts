import { describe, expect, it } from 'vitest';

import {
  InsufficientCreditsError,
  currentBalance,
  moveCredits,
  refreshActiveListings,
  refreshHeldCount,
  type CreditMovement,
} from '../../../../src/modules/billing/credits.service.js';
import type { Tx } from '../../../../src/platform/db/prisma.js';
import { DomainError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/billing/credits.service.ts`.
 *
 * This is the only function in the codebase allowed to move a credit balance, and
 * every rule in ARCHITECTURE §26.2 lives inside it. `credits.test.ts` proves those
 * rules against a real database, including the `FOR UPDATE` serialisation. What it
 * cannot show is the *shape* of what gets written — that the balance is read from
 * the ledger rather than from `Dealer.creditBalance`, that the cache update is
 * part of the same transaction, that nothing is written at all when the balance
 * would go negative. Those are asserted here by capturing the calls.
 */
const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';

interface Recorder {
  tx: Tx;
  queries: string[];
  creates: Record<string, unknown>[];
  dealerUpdates: { where: { id: string }; data: Record<string, unknown> }[];
  countArgs: Record<string, unknown>[];
  order: string[];
}

function fakeTx(
  options: {
    lockedRows?: { credit_balance: number }[];
    newestBalance?: number | null;
    listingCount?: number;
  } = {},
): Recorder {
  const queries: string[] = [];
  const creates: Record<string, unknown>[] = [];
  const dealerUpdates: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const countArgs: Record<string, unknown>[] = [];
  const order: string[] = [];

  const tx = {
    $queryRaw: (strings: TemplateStringsArray) => {
      order.push('lock');
      queries.push(strings.join('?'));
      return Promise.resolve(options.lockedRows ?? [{ credit_balance: 0 }]);
    },
    creditTransaction: {
      findFirst: (args: Record<string, unknown>) => {
        order.push('read-ledger');
        countArgs.push(args);
        return Promise.resolve(
          options.newestBalance === null || options.newestBalance === undefined
            ? null
            : { balanceAfter: options.newestBalance },
        );
      },
      create: (args: { data: Record<string, unknown> }) => {
        order.push('append');
        creates.push(args.data);
        return Promise.resolve({ id: 'txn-1', ...args.data });
      },
    },
    dealer: {
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        order.push('refresh-cache');
        dealerUpdates.push(args);
        return Promise.resolve({});
      },
    },
    listing: {
      count: (args: Record<string, unknown>) => {
        countArgs.push(args);
        return Promise.resolve(options.listingCount ?? 0);
      },
    },
  } as unknown as Tx;

  return { tx, queries, creates, dealerUpdates, countArgs, order };
}

const movement = (overrides: Partial<CreditMovement> = {}): CreditMovement => ({
  dealerId: DEALER,
  delta: -1,
  reason: 'HOLD_SUBMIT',
  label: 'Submitted for review — 2021 Maruti Suzuki Alto 800',
  actorType: 'DEALER',
  ...overrides,
});

describe('moveCredits', () => {
  it('locks the dealer row before reading the balance', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement());

    // Rule 1: this is what makes two concurrent submits serialise instead of both
    // reading a balance of 1 and both succeeding.
    expect(recorder.queries[0]).toContain('FOR UPDATE');
    expect(recorder.order[0]).toBe('lock');
  });

  it('locks by casting the id to uuid, so a text comparison cannot slip through', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement());

    expect(recorder.queries[0]).toContain('::uuid');
  });

  it('reads the balance from the ledger, not from the cached column', async () => {
    const recorder = fakeTx({ lockedRows: [{ credit_balance: 999 }], newestBalance: 5 });

    const result = await moveCredits(recorder.tx, movement());

    // Rule 2: `Dealer.creditBalance` is a read cache and is untrusted by every
    // write path. Trusting it here is how a drifted cache becomes free credits.
    expect(result.balanceBefore).toBe(5);
    expect(result.balanceAfter).toBe(4);
  });

  it('reads the newest ledger row by its append sequence', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement());

    // Not by `createdAt`: statements in one transaction share `now()`, so two rows
    // written together would be indistinguishable by timestamp.
    expect(recorder.countArgs[0]).toMatchObject({
      where: { dealerId: DEALER },
      orderBy: { seq: 'desc' },
    });
  });

  it('treats a dealership with no ledger rows as a zero balance', async () => {
    const recorder = fakeTx({ newestBalance: null });

    const result = await moveCredits(recorder.tx, movement({ delta: 10, reason: 'PURCHASE' }));

    expect(result.balanceBefore).toBe(0);
    expect(result.balanceAfter).toBe(10);
  });

  it('appends a row with the materialised balance and refreshes the cache', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement());

    // Rule 3, and both inside the caller's transaction.
    expect(recorder.creates[0]).toMatchObject({
      dealerId: DEALER,
      delta: -1,
      balanceAfter: 4,
      reason: 'HOLD_SUBMIT',
    });
    expect(recorder.dealerUpdates[0]).toEqual({
      where: { id: DEALER },
      data: { creditBalance: 4 },
    });
  });

  it('appends before refreshing, so the cache never leads the ledger', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement());

    expect(recorder.order).toEqual(['lock', 'read-ledger', 'append', 'refresh-cache']);
  });

  it('writes a delta of zero, because the row itself is the record', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    const result = await moveCredits(
      recorder.tx,
      movement({ delta: 0, reason: 'CONSUME_APPROVE' }),
    );

    // `CONSUME_APPROVE` moves nothing — the credit was already taken at submit —
    // but the row must still exist, because its absence is what the
    // reconciliation job flags as an unpaid listing.
    expect(recorder.creates).toHaveLength(1);
    expect(result.balanceAfter).toBe(5);
  });

  it('carries the label verbatim into the dealer’s history', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement({ label: 'Renewal submitted — 2019 Swift VDI' }));

    expect(recorder.creates[0]?.label).toBe('Renewal submitted — 2019 Swift VDI');
  });

  it('records the listing, order, actor and idempotency key when given', async () => {
    const recorder = fakeTx({ newestBalance: 0 });

    await moveCredits(
      recorder.tx,
      movement({
        delta: 10,
        reason: 'PURCHASE',
        listingId: 'listing-1',
        orderId: 'order-1',
        actorType: 'SYSTEM',
        actorId: 'user-1',
        idempotencyKey: 'razorpay:pay_123',
      }),
    );

    expect(recorder.creates[0]).toMatchObject({
      listingId: 'listing-1',
      orderId: 'order-1',
      actorType: 'SYSTEM',
      actorId: 'user-1',
      idempotencyKey: 'razorpay:pay_123',
    });
  });

  it('normalises the optional references to null', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    await moveCredits(recorder.tx, movement());

    expect(recorder.creates[0]).toMatchObject({
      listingId: null,
      orderId: null,
      actorId: null,
      idempotencyKey: null,
    });
  });

  it('refuses a movement that would take the balance negative', async () => {
    const recorder = fakeTx({ newestBalance: 0 });

    await expect(moveCredits(recorder.tx, movement())).rejects.toThrow(InsufficientCreditsError);
    // Nothing written: not the ledger row, not the cache.
    expect([recorder.creates, recorder.dealerUpdates]).toEqual([[], []]);
  });

  it('allows a movement down to exactly zero', async () => {
    const recorder = fakeTx({ newestBalance: 1 });

    const result = await moveCredits(recorder.tx, movement());

    expect(result.balanceAfter).toBe(0);
  });

  it('reports how many credits were needed and what the balance was', async () => {
    const recorder = fakeTx({ newestBalance: 1 });

    try {
      await moveCredits(recorder.tx, movement({ delta: -3 }));
      expect.unreachable('a negative balance must be refused');
    } catch (error) {
      const domain = error as InsufficientCreditsError;
      expect(domain.code).toBe('INSUFFICIENT_CREDITS');
      expect(domain.detail).toContain('needs 3 credits');
      expect(domain.detail).toContain('balance is 1');
    }
  });

  it('refuses a dealership that no longer exists', async () => {
    const recorder = fakeTx({ lockedRows: [] });

    await expect(moveCredits(recorder.tx, movement())).rejects.toThrow(DomainError);
    await expect(moveCredits(recorder.tx, movement())).rejects.toThrow(/no longer exists/);
  });

  it('returns the id of the row it appended', async () => {
    const recorder = fakeTx({ newestBalance: 5 });

    expect((await moveCredits(recorder.tx, movement())).transactionId).toBe('txn-1');
  });
});

describe('InsufficientCreditsError', () => {
  it('is a 422 with an action the dealer can take', () => {
    const error = new InsufficientCreditsError(1, 0);

    expect(error.status).toBe(422);
    expect(error.code).toBe('INSUFFICIENT_CREDITS');
    expect(error.title).toBe('Not enough listing credits');
    expect(error.extra).toEqual({
      creditBalance: 0,
      actionLabel: 'Buy credits',
      actionHref: '/dealer/billing',
    });
  });

  it('pluralises the requirement', () => {
    expect(new InsufficientCreditsError(1, 0).detail).toContain('needs 1 credit.');
    expect(new InsufficientCreditsError(2, 0).detail).toContain('needs 2 credits.');
  });

  it('takes a different action link when the caller has a better one', () => {
    const error = new InsufficientCreditsError(1, 0, '/dealer/billing?pack=growth');

    expect(error.extra?.actionHref).toBe('/dealer/billing?pack=growth');
  });
});

describe('currentBalance', () => {
  it('reads the newest ledger row rather than summing the deltas', async () => {
    const recorder = fakeTx({ newestBalance: 39 });

    expect(await currentBalance(recorder.tx, DEALER)).toBe(39);
    // A sum over a long ledger is both slower and a second way to compute the
    // same number — which is a second way to get it wrong.
    expect(recorder.countArgs[0]).toMatchObject({ orderBy: { seq: 'desc' } });
  });

  it('reports zero for a dealership with no movements', async () => {
    const recorder = fakeTx({ newestBalance: null });

    expect(await currentBalance(recorder.tx, DEALER)).toBe(0);
  });

  it('scopes the read to the dealership', async () => {
    const recorder = fakeTx({ newestBalance: 1 });

    await currentBalance(recorder.tx, DEALER);

    expect(recorder.countArgs[0]).toMatchObject({ where: { dealerId: DEALER } });
  });
});

describe('refreshHeldCount', () => {
  it('counts the listings that are actually holding a credit', async () => {
    const recorder = fakeTx({ listingCount: 2 });

    expect(await refreshHeldCount(recorder.tx, DEALER)).toBe(2);
    expect(recorder.countArgs[0]).toEqual({
      where: {
        dealerId: DEALER,
        creditHeld: true,
        status: { in: ['PENDING_REVIEW', 'CHANGES_REQUESTED'] },
      },
    });
  });

  it('includes CHANGES_REQUESTED, because that hold survives', async () => {
    const recorder = fakeTx({ listingCount: 1 });

    await refreshHeldCount(recorder.tx, DEALER);

    // The surviving hold is what separates "request changes" from "reject";
    // leaving it out of the count would show the dealer a credit they cannot use.
    const status = (recorder.countArgs[0]?.where as { status: { in: string[] } }).status;
    expect(status.in).toContain('CHANGES_REQUESTED');
  });

  it('writes the count onto the dealership', async () => {
    const recorder = fakeTx({ listingCount: 3 });

    await refreshHeldCount(recorder.tx, DEALER);

    // §26.8: recomputed from live rows rather than incremented, so it cannot
    // drift.
    expect(recorder.dealerUpdates[0]).toEqual({
      where: { id: DEALER },
      data: { creditsHeld: 3 },
    });
  });

  it('writes a zero when nothing is held', async () => {
    const recorder = fakeTx({ listingCount: 0 });

    await refreshHeldCount(recorder.tx, DEALER);

    expect(recorder.dealerUpdates[0]?.data).toEqual({ creditsHeld: 0 });
  });
});

describe('refreshActiveListings', () => {
  it('counts only APPROVED listings', async () => {
    const recorder = fakeTx({ listingCount: 7 });

    expect(await refreshActiveListings(recorder.tx, DEALER)).toBe(7);
    expect(recorder.countArgs[0]).toEqual({ where: { dealerId: DEALER, status: 'APPROVED' } });
  });

  it('writes the count onto the dealership', async () => {
    const recorder = fakeTx({ listingCount: 7 });

    await refreshActiveListings(recorder.tx, DEALER);

    expect(recorder.dealerUpdates[0]).toEqual({
      where: { id: DEALER },
      data: { activeListings: 7 },
    });
  });

  it('is a recount, not a decrement', async () => {
    const recorder = fakeTx({ listingCount: 0 });

    await refreshActiveListings(recorder.tx, DEALER);

    // A decrement drifts the moment two things touch the row; a recount cannot.
    expect(recorder.dealerUpdates[0]?.data).toEqual({ activeListings: 0 });
  });
});
