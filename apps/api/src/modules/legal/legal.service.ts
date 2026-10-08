import {
  LEGAL_VERSION,
  type DealerAcceptanceInput,
  type LegalEvidenceQuery,
  type TermsAcceptanceInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { DomainError, ForbiddenError, UnauthorizedError } from '../../platform/errors.js';
import { authorizeDealerWrite } from '../auth/auth.facade.js';
import type { AdminPrincipal, DealerPrincipal, Principal } from '../auth/auth.facade.js';
import {
  acceptDealer,
  acceptTerms,
  accountIds,
  hasDealerAgreement,
  hasTerms,
  legalEnabled,
} from './legal.evidence.js';

export function createLegalService(prisma: PrismaClient) {
  function requireEnabled(): void {
    if (!legalEnabled())
      throw new DomainError(
        'LEGAL_NOT_ACTIVE',
        'Legal acceptance has not been activated for this deployment.',
      );
  }

  async function authorize(tx: Tx, principal: Principal): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: principal.userId },
      select: { status: true },
    });
    if (user?.status !== 'ACTIVE') throw new UnauthorizedError();
  }

  return {
    async status(principal: Principal) {
      const dealer = principal.kind === 'DEALER' ? principal : null;
      return {
        enabled: legalEnabled(),
        version: LEGAL_VERSION,
        termsRequired: !(await hasTerms(prisma, principal.userId)),
        dealerRequired: dealer ? !(await hasDealerAgreement(prisma, dealer.dealerId)) : false,
        mayBindDealer: dealer?.role === 'OWNER',
      };
    },

    async history(principal: Principal) {
      const ids = await accountIds(prisma, principal.userId);
      const data = await prisma.legalEvent.findMany({
        where: { actorId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          documentId: true,
          version: true,
          digest: true,
          action: true,
          subjectType: true,
          subjectId: true,
          context: true,
          createdAt: true,
        },
      });
      return { data: data.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
    },

    async adminHistory(principal: AdminPrincipal, query: LegalEvidenceQuery) {
      if (!principal.permissions.includes('admin:audit:read'))
        throw new ForbiddenError('This action needs audit access.');
      const data = await prisma.legalEvent.findMany({
        where: query,
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          documentId: true,
          version: true,
          digest: true,
          action: true,
          subjectType: true,
          subjectId: true,
          context: true,
          createdAt: true,
        },
      });
      return { data: data.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
    },

    async terms(principal: Principal, input: TermsAcceptanceInput) {
      requireEnabled();
      await withTransaction(prisma, async (tx) => {
        await authorize(tx, principal);
        await acceptTerms(tx, principal.userId, input, 'account-agreement-update');
      });
      return this.status(principal);
    },

    async dealer(principal: DealerPrincipal, input: DealerAcceptanceInput) {
      requireEnabled();
      await withTransaction(prisma, async (tx) => {
        await authorizeDealerWrite(tx, principal, 'dealer:update');
        await acceptDealer(tx, principal.userId, principal.dealerId, input);
      });
      return this.status(principal);
    },
  };
}
export type LegalService = ReturnType<typeof createLegalService>;
