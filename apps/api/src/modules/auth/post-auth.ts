import { dealerSessionNext, type SessionNext } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ForbiddenError } from '../../platform/errors.js';
import { DEALERSHIP_CLOSED, DEALERSHIP_SUSPENDED } from './auth.messages.js';
import { findWorkspaceMembership } from './membership.js';
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
  const { membership, suspended, closed } = await findWorkspaceMembership(db, userId);

  if (closed) {
    throw new ForbiddenError(DEALERSHIP_CLOSED, { code: 'APPLICATION_CLOSED' });
  }
  if (suspended) {
    throw new ForbiddenError(DEALERSHIP_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
  }

  const next = dealerSessionNext(membership?.dealer.status ?? null);

  return {
    next,
    returnTo:
      next === 'ONBOARDING' ? ONBOARDING_PATH : safeReturnTo(requested, DEFAULT_RETURN_TO.DEALER),
  };
}
