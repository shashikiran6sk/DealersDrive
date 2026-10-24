import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  LEGAL_REQUIRED,
  legalV1Enabled,
  type LegalScope,
  type LegalStatus,
} from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { ForbiddenError } from '../../platform/errors.js';
import { authorizeDealerWrite } from '../auth/auth.facade.js';
import type { CustomerPrincipal, DealerPrincipal, PendingPrincipal } from '../auth/auth.facade.js';

type Db = PrismaClient | Prisma.TransactionClient;
export type LegalPerson = CustomerPrincipal | DealerPrincipal | PendingPrincipal;
const VERSIONS: Pick<LegalStatus, 'termsVersion' | 'privacyVersion'> = {
  termsVersion: LEGAL_TERMS_VERSION,
  privacyVersion: LEGAL_PRIVACY_VERSION,
};

export function legalEnabled(): boolean {
  return legalV1Enabled(env.APP_ENV === 'production', process.env.LEGAL_V1_PREVIEW === 'true');
}

export function legalRequired(): ForbiddenError {
  return new ForbiddenError(
    'Sign in and accept the Terms & Conditions and Privacy Policy to continue.',
    { code: LEGAL_REQUIRED },
  );
}

export async function hasDealerAcceptance(db: Db, dealerId: string): Promise<boolean> {
  return Boolean(
    await db.legalAcceptance.findUnique({
      where: {
        subjectKey_termsVersion_privacyVersion: { subjectKey: `DEALER:${dealerId}`, ...VERSIONS },
      },
    }),
  );
}

export async function requireDealerAcceptance(db: Db, dealerId: string): Promise<void> {
  if (legalEnabled() && !(await hasDealerAcceptance(db, dealerId))) throw legalRequired();
}

async function hasPersonalAcceptance(db: Db, userId: string): Promise<boolean> {
  return Boolean(
    await db.legalAcceptance.findFirst({
      where: {
        dealerId: null,
        ...VERSIONS,
        user: { OR: [{ id: userId }, { mergedIntoId: userId }] },
      },
    }),
  );
}

async function record(db: Db, userId: string, dealerId: string | null): Promise<void> {
  const subjectKey = dealerId ? `DEALER:${dealerId}` : `USER:${userId}`;
  await db.legalAcceptance.createMany({
    data: { userId, dealerId, subjectKey, ...VERSIONS },
    skipDuplicates: true,
  });
}

export async function acceptDealerPolicies(
  tx: Prisma.TransactionClient,
  principal: DealerPrincipal,
): Promise<void> {
  await authorizeDealerWrite(tx, principal, 'dealer:update');
  const membership = await tx.dealerMember.findUnique({
    where: { dealerId_userId: { dealerId: principal.dealerId, userId: principal.userId } },
  });
  if (membership?.role !== 'OWNER' || membership.status !== 'ACTIVE') {
    throw new ForbiddenError(
      'The dealership owner must accept the policies from their own account.',
      { code: 'LEGAL_OWNER_REQUIRED' },
    );
  }
  await record(tx, principal.userId, principal.dealerId);
  if (!(await hasPersonalAcceptance(tx, principal.userId)))
    await record(tx, principal.userId, null);
}

export function createLegalService(prisma: PrismaClient) {
  return {
    async status(person: LegalPerson, scope: LegalScope): Promise<LegalStatus> {
      const personal = !legalEnabled() || (await hasPersonalAcceptance(prisma, person.userId));
      const dealer = scope === 'DEALER' && person.kind === 'DEALER';
      const accepted =
        personal &&
        (!dealer || !legalEnabled() || (await hasDealerAcceptance(prisma, person.dealerId)));
      return {
        enabled: legalEnabled(),
        accepted,
        canAccept:
          !dealer ||
          person.role === 'OWNER' ||
          (await hasDealerAcceptance(prisma, person.dealerId)),
        ...VERSIONS,
      };
    },
    async accept(person: LegalPerson, scope: LegalScope): Promise<LegalStatus> {
      if (!legalEnabled())
        throw new ForbiddenError('The legal release is not active.', { code: 'LEGAL_NOT_ACTIVE' });
      await prisma.$transaction(async (tx) => {
        if (scope === 'DEALER' && person.kind === 'DEALER') {
          if (person.role === 'OWNER') await acceptDealerPolicies(tx, person);
          else {
            await requireDealerAcceptance(tx, person.dealerId);
            await record(tx, person.userId, null);
          }
        } else {
          if (scope === 'DEALER')
            throw new ForbiddenError('Save the dealership draft before accepting for it.', {
              code: 'LEGAL_DEALER_REQUIRED',
            });
          await record(tx, person.userId, null);
        }
      });
      return this.status(person, scope);
    },
    async require(person: LegalPerson, scope: LegalScope): Promise<void> {
      if (!(await this.status(person, scope)).accepted) throw legalRequired();
    },
  };
}
export type LegalService = ReturnType<typeof createLegalService>;
