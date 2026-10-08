import type { Prisma } from '@prisma/client';

export const DOMAIN_CHECK_MAX_AGE_MS = 24 * 60 * 60_000;

export function liveDomainWhere(defaultDomainReady: boolean): Prisma.StorefrontDomainWhereInput {
  return {
    status: 'ACTIVE',
    certificateReady: true,
    verifiedAt: { not: null },
    OR: [
      ...(defaultDomainReady ? [{ kind: 'DEFAULT' as const }] : []),
      {
        kind: 'CUSTOM',
        ownershipVerifiedAt: { not: null },
        checkedAt: { gte: new Date(Date.now() - DOMAIN_CHECK_MAX_AGE_MS) },
      },
    ],
  };
}

export function liveStorefrontWhere(
  defaultDomainReady: boolean,
): Prisma.DealerStorefrontWhereInput {
  return {
    status: 'ACTIVE',
    dealer: { status: 'ACTIVE' },
    domains: { some: { ...liveDomainWhere(defaultDomainReady), isPrimary: true } },
  };
}
