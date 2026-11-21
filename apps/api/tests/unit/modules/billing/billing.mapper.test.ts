import type { CreditOrder, CreditTransaction } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  changeLabel,
  toLedgerEntry,
  toOrderRow,
} from '../../../../src/modules/billing/billing.mapper.js';

function row(overrides: Partial<CreditTransaction>): CreditTransaction {
  return {
    id: 7n,
    dealerId: '11111111-1111-4111-8111-111111111111',
    reason: 'PURCHASE',
    delta: 5,
    heldDelta: 0,
    balanceAfter: 5,
    heldAfter: 0,
    listingId: null,
    orderId: null,
    actorType: 'DEALER',
    actorId: null,
    note: null,
    createdAt: new Date('2026-11-11T09:00:00Z'),
    ...overrides,
  };
}

describe('the ledger as a dealer reads it', () => {
  it('says what moved', () => {
    expect(changeLabel({ delta: 5, heldDelta: 0 })).toBe('+5');
    expect(changeLabel({ delta: -1, heldDelta: -1 })).toBe('−1');
    expect(changeLabel({ delta: 0, heldDelta: 2 })).toBe('2 held');
    expect(changeLabel({ delta: 0, heldDelta: -1 })).toBe('1 returned');
  });

  it('serialises the bigint id and works out what was available after', () => {
    const entry = toLedgerEntry(
      row({ reason: 'HOLD_SUBMIT', delta: 0, heldDelta: 1, balanceAfter: 5, heldAfter: 1 }),
    );
    expect(entry).toMatchObject({
      id: '7',
      availableAfter: 4,
      tone: 'warn',
      label: 'Held for a listing in review',
    });
  });
});

describe('when a payment or a credit movement happened', () => {
  const justAfterMidnightInIndia = new Date('2026-11-20T18:50:00Z');

  it('reads in India Standard Time, with the time, not as the UTC day', () => {
    expect(toLedgerEntry(row({ createdAt: justAfterMidnightInIndia })).dateLabel).toBe(
      '21 Nov 2026, 00:20',
    );
    const order = {
      id: '22222222-2222-4222-8222-222222222222',
      dealerId: '11111111-1111-4111-8111-111111111111',
      credits: 1,
      amountPaise: 50_000n,
      taxPaise: 0n,
      totalPaise: 50_000n,
      status: 'PAID',
      gateway: 'razorpay',
      gatewayOrderId: 'order_TEST',
      gatewayPaymentId: 'pay_TEST',
      failureReason: null,
      createdAt: justAfterMidnightInIndia,
      paidAt: justAfterMidnightInIndia,
    } as unknown as CreditOrder;
    expect(toOrderRow(order).dateLabel).toBe('21 Nov 2026, 00:20');
  });
});
