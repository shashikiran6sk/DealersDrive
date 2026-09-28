import { dealerSessionNext, type SessionNext } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ForbiddenError } from '../../platform/errors.js';
import { DEALERSHIP_SUSPENDED } from './auth.messages.js';
import { DEFAULT_RETURN_TO, safeReturnTo } from './oauth-transaction.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const ONBOARDING_PATH = '/dealer/onboarding';

export interface DealerDestination {
  next: SessionNext;
  returnTo: string;
}

export async function resolveDealerPostAuthDestination(
  db: Db,
  userId: string,
  requested?: string,
): Promise<DealerDestination> {
  const membership = await db.dealerMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { dealer: { select: { status: true } } },
    orderBy: { id: 'asc' },
  });

  if (membership?.dealer.status === 'SUSPENDED') {
    throw new ForbiddenError(DEALERSHIP_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
  }

  const next = dealerSessionNext(membership?.dealer.status ?? null);

  return {
    next,
    returnTo:
      next === 'ONBOARDING' ? ONBOARDING_PATH : safeReturnTo(requested, DEFAULT_RETURN_TO.DEALER),
  };
}
