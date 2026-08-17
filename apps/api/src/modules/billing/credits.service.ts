import type { CreditReason } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import { DomainError } from '../../platform/errors.js';

/**
 * The one function that is allowed to move a credit balance.
 *
 * Every rule in ARCHITECTURE §26.2 lives here, in one place, so that nothing
 * anywhere else has to remember them:
 *
 *   1. `SELECT … FOR UPDATE` on the dealer row. This is what makes two
 *      concurrent submits from the same dealer serialise instead of both
 *      reading a balance of 1 and both succeeding.
 *   2. The balance is read from the **ledger**, not from `Dealer.creditBalance`
 *      — that column is a read cache and is treated as untrusted by every
 *      write path.
 *   3. A row is appended with a materialised `balanceAfter`, and the cache is
 *      updated in the same transaction.
 *   4. It takes a `Tx`, never a client, so the movement and the state change it
 *      pays for cannot be committed separately.
 *
 * There is no `addCredits` and no `spendCredits` — there is this, and callers
 * pass a signed delta and a reason.
 */
export interface CreditMovement {
  dealerId: string;
  delta: number;
  reason: CreditReason;
  /** Shown verbatim in the dealer's credit history. Write it for them, not for you. */
  label: string;
  listingId?: string | null;
  orderId?: string | null;
  actorType: 'DEALER' | 'ADMIN' | 'SYSTEM';
  actorId?: string | null;
  /** Webhook and retry safety. Unique across the table (§26.4). */
  idempotencyKey?: string;
}

export interface CreditMovementResult {
  transactionId: string;
  balanceBefore: number;
  balanceAfter: number;
}

export interface InsufficientCreditsDetail {
  required: number;
  balance: number;
}

export class InsufficientCreditsError extends DomainError {
  constructor(required: number, balance: number, actionHref = '/dealer/billing') {
    super(
      'INSUFFICIENT_CREDITS',
      `Publishing this vehicle needs ${required} credit${required === 1 ? '' : 's'}. Your balance is ${balance}.`,
      {
        title: 'Not enough listing credits',
        extra: { creditBalance: balance, actionLabel: 'Buy credits', actionHref },
      },
    );
  }
}

export async function moveCredits(tx: Tx, movement: CreditMovement): Promise<CreditMovementResult> {
  // 1. Lock the dealer row. Everything below is serialised per dealer.
  const locked = await tx.$queryRaw<{ credit_balance: number }[]>`
    SELECT "creditBalance" AS credit_balance FROM dealers WHERE id = ${movement.dealerId}::uuid FOR UPDATE`;

  if (locked.length === 0) {
    throw new DomainError('DEALER_NOT_FOUND', 'That dealership no longer exists.');
  }

  // 2. The ledger is the truth; the column is only its cache.
  const newest = await tx.creditTransaction.findFirst({
    where: { dealerId: movement.dealerId },
    orderBy: { seq: 'desc' },
    select: { balanceAfter: true },
  });

  const balanceBefore = newest?.balanceAfter ?? 0;
  const balanceAfter = balanceBefore + movement.delta;

  if (balanceAfter < 0) {
    throw new InsufficientCreditsError(Math.abs(movement.delta), balanceBefore);
  }

  // 3. Append, then refresh the cache — both inside the caller's transaction.
  const row = await tx.creditTransaction.create({
    data: {
      dealerId: movement.dealerId,
      delta: movement.delta,
      balanceAfter,
      reason: movement.reason,
      label: movement.label,
      listingId: movement.listingId ?? null,
      orderId: movement.orderId ?? null,
      actorType: movement.actorType,
      actorId: movement.actorId ?? null,
      idempotencyKey: movement.idempotencyKey ?? null,
    },
  });

  await tx.dealer.update({
    where: { id: movement.dealerId },
    data: { creditBalance: balanceAfter },
  });

  return { transactionId: row.id, balanceBefore, balanceAfter };
}

/** Reads the authoritative balance — the newest ledger row, never a sum. */
export async function currentBalance(tx: Tx, dealerId: string): Promise<number> {
  const newest = await tx.creditTransaction.findFirst({
    where: { dealerId },
    orderBy: { seq: 'desc' },
    select: { balanceAfter: true },
  });
  return newest?.balanceAfter ?? 0;
}

/** Keeps `Dealer.creditsHeld` equal to the live held-listing count (§26.8). */
export async function refreshHeldCount(tx: Tx, dealerId: string): Promise<number> {
  const held = await tx.listing.count({
    where: {
      dealerId,
      creditHeld: true,
      status: { in: ['PENDING_REVIEW', 'CHANGES_REQUESTED'] },
    },
  });
  await tx.dealer.update({ where: { id: dealerId }, data: { creditsHeld: held } });
  return held;
}

export async function refreshActiveListings(tx: Tx, dealerId: string): Promise<number> {
  const active = await tx.listing.count({ where: { dealerId, status: 'APPROVED' } });
  await tx.dealer.update({ where: { id: dealerId }, data: { activeListings: active } });
  return active;
}
