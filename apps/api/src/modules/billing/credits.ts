import type { CreditReason } from '@dealers-drive/contracts';
import type { CreditTransaction } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import { DomainError, NotFoundError } from '../../platform/errors.js';
import {
  CREDITS_WOULD_GO_NEGATIVE,
  DEALER_NOT_FOUND,
  INSUFFICIENT_CREDITS,
} from './billing.messages.js';

export interface CreditActor {
  type: 'DEALER' | 'ADMIN' | 'SALES' | 'SYSTEM';
  id: string | null;
}

export interface CreditMove {
  dealerId: string;
  reason: CreditReason;
  delta?: number;
  heldDelta?: number;
  listingId?: string | null;
  orderId?: string | null;
  actor: CreditActor;
  note?: string | null;
}

export interface CreditBalance {
  balance: number;
  held: number;
  available: number;
}

export async function lockDealerCredits(tx: Tx, dealerId: string): Promise<CreditBalance> {
  const [dealer] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
  if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND, { code: 'DEALER_NOT_FOUND' });
  return ledgerBalance(tx, dealerId);
}

export async function ledgerBalance(tx: Tx, dealerId: string): Promise<CreditBalance> {
  const last = await tx.creditTransaction.findFirst({
    where: { dealerId },
    orderBy: { id: 'desc' },
    select: { balanceAfter: true, heldAfter: true },
  });
  const balance = last?.balanceAfter ?? 0;
  const held = last?.heldAfter ?? 0;
  return { balance, held, available: balance - held };
}

export async function moveCredits(tx: Tx, move: CreditMove): Promise<CreditTransaction> {
  const delta = move.delta ?? 0;
  const heldDelta = move.heldDelta ?? 0;
  const before = await lockDealerCredits(tx, move.dealerId);
  const balanceAfter = before.balance + delta;
  const heldAfter = before.held + heldDelta;

  if (heldAfter > balanceAfter && heldDelta > 0) {
    throw new DomainError(
      'INSUFFICIENT_CREDITS',
      INSUFFICIENT_CREDITS(heldDelta, before.available),
      {
        extra: {
          required: heldDelta,
          available: before.available,
          actionLabel: 'Buy credits',
          actionHref: '/dealer/billing',
        },
      },
    );
  }
  if (balanceAfter < 0 || heldAfter < 0 || heldAfter > balanceAfter) {
    throw new DomainError('CREDITS_NEGATIVE', CREDITS_WOULD_GO_NEGATIVE(before.available), {
      extra: { available: before.available },
    });
  }

  const row = await tx.creditTransaction.create({
    data: {
      dealerId: move.dealerId,
      reason: move.reason,
      delta,
      heldDelta,
      balanceAfter,
      heldAfter,
      listingId: move.listingId ?? null,
      orderId: move.orderId ?? null,
      actorType: move.actor.type,
      actorId: move.actor.id,
      note: move.note ?? null,
    },
  });
  await tx.dealer.update({
    where: { id: move.dealerId },
    data: { creditBalance: balanceAfter, creditsHeld: heldAfter },
  });
  return row;
}
