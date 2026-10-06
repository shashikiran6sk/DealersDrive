import type { Prisma } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { RESEND_COOLDOWN_MS } from './claim-token.js';

type Tx = Prisma.TransactionClient;

export interface EmailVerificationRequest {
  dealerId: string;
  email: string;
  memberId: string | null;
  actorUserId: string;
}

export async function supersedeEmailVerifications(tx: Tx, dealerId: string): Promise<number> {
  const result = await tx.dealerEmailVerification.updateMany({
    where: { dealerId, supersededAt: null, claimedAt: null },
    data: { supersededAt: new Date() },
  });
  return result.count;
}

export async function requestEmailVerification(
  tx: Tx,
  request: EmailVerificationRequest,
): Promise<{ id: string }> {
  await supersedeEmailVerifications(tx, request.dealerId);
  const row = await tx.dealerEmailVerification.create({
    data: {
      dealerId: request.dealerId,
      email: request.email.trim().toLowerCase(),
      requestedByMemberId: request.memberId,
    },
    select: { id: true },
  });
  await enqueueOutbox(tx, {
    type: 'DealerEmailVerificationRequested',
    aggregateType: 'DealerEmailVerification',
    aggregateId: row.id,
    dealerId: request.dealerId,
    actor: { type: 'ADMIN', id: request.actorUserId },
    traceId: getContext()?.traceId ?? 'dealer-email-verification',
    payload: { verificationId: row.id },
  });
  return row;
}

export function withinCooldown(last: { createdAt: Date } | null, now = Date.now()): boolean {
  return last !== null && now - last.createdAt.getTime() < RESEND_COOLDOWN_MS;
}
